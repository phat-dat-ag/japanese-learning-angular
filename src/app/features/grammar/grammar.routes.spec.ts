import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';
import {
  grammarLesson,
  grammarOk,
  grammarResponseFixture,
} from '../admin/lessons/testing/grammar-content.fixture';

describe('Grammar learning authorization and navigation', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function signIn(role: string) {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'account', username: role, role });
  }
  it.each(['/grammar', '/grammar/9'])('redirects guests from %s to login', async (url) => {
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone(() => true);
  });
  it.each(['User', 'Admin'])(
    'permits %s accounts to browse and read without editing controls',
    async (role) => {
      signIn(role);
      const harness = await RouterTestingHarness.create('/grammar');
      http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk([grammarLesson]));
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('a[href="/grammar/9"]')).not.toBeNull();
      expect(
        harness
          .routeNativeElement!.querySelector('nav a[aria-current="page"]')
          ?.getAttribute('href'),
      ).toBe('/grammar');
      await harness.navigateByUrl('/grammar/9');
      http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
      http.expectOne('/api/v1/jlpt-levels').flush(grammarOk([{ id: 72, code: 'N5', name: 'N5' }]));
      http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
      http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk([grammarLesson]));
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('article')).not.toBeNull();
      expect(
        harness.routeNativeElement!.querySelector(
          'app-grammar-block-editor, textarea, a[href*="/admin/lessons/"]',
        ),
      ).toBeNull();
    },
  );
  it('keeps Admin separation for existing learner routes and exposes reading from the Admin menu', async () => {
    signIn('Admin');
    const harness = await RouterTestingHarness.create('/flashcards');
    expect(TestBed.inject(Router).url).toBe('/admin');
    const readLink =
      harness.routeNativeElement!.querySelector<HTMLAnchorElement>('nav a[href="/grammar"]');
    expect(readLink).not.toBeNull();
    readLink!.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/grammar'));
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk([]));
  });
  it('keeps User accounts out of Admin editing routes', async () => {
    signIn('User');
    await RouterTestingHarness.create('/admin/lessons/9/content');
    expect(TestBed.inject(Router).url).toBe('/flashcards');
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk([]));
    http
      .expectOne('/api/v1/flashcards/statistics?')
      .flush(null, { status: 503, statusText: 'Unavailable in this route test' });
    http
      .expectOne('/api/v1/flashcards/sessions?status=IN_PROGRESS&page=0&size=20')
      .flush(null, { status: 503, statusText: 'Unavailable in this route test' });
  });
  it('leaves the mounted reading shell when the session ends', async () => {
    signIn('User');
    const harness = await RouterTestingHarness.create('/grammar');
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk([]));
    TestBed.inject(AuthSession).clear();
    harness.detectChanges();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
  });
});
