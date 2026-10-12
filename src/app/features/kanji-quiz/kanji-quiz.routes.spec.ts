import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';
import { QuizPlayerService } from './services/quiz-player.service';
import { config, success } from './testing/quiz-player.fixture';

describe('Kanji Quiz player routing', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: QuizPlayerService, useValue: { getConfig: () => of(success(config)) } },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function signIn(role = 'User'): void {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'user', username: 'Learner', role });
  }

  it.each(['/kanji-quiz', '/kanji-quiz/sessions/42'])(
    'protects anonymous access to %s',
    async (url) => {
      await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/login');
    },
  );

  it.each(['/kanji-quiz', '/kanji-quiz/sessions/42'])(
    'preserves Admin separation for %s',
    async (url) => {
      signIn('Admin');
      await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/admin');
    },
  );

  it('shows the player entry point and setup for a User', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz');
    expect(harness.routeNativeElement?.querySelector('a[href="/kanji-quiz"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Game Setup');
  });

  it('preserves a deep-linked session ID and reacts to route parameter changes', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/42');
    expect(harness.routeNativeElement?.textContent).toContain('Session 42');
    await harness.navigateByUrl('/kanji-quiz/sessions/73');
    expect(harness.routeNativeElement?.textContent).toContain('Session 73');
    expect(harness.routeNativeElement?.textContent).toContain('Gameplay is not available yet');
  });

  it.each(['0', '-1', 'abc', '9007199254740992'])('handles invalid session ID %s', async (id) => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/' + id);
    expect(harness.routeNativeElement?.textContent).toContain('Invalid session ID');
  });
});
