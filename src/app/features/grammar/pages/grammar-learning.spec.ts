import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '../../../core/auth/auth-session.service';
import {
  grammarLesson,
  grammarMeta,
  grammarOk,
  grammarResponseFixture,
} from '../../admin/lessons/testing/grammar-content.fixture';
import { GRAMMAR_ROUTES } from '../grammar.routes';
import { GrammarLessonReader } from './grammar-lesson-reader';
import { GrammarLessons } from './grammar-lessons';

const levels = [
  { id: 72, code: 'N5', name: 'N5' },
  { id: 28, code: 'N4', name: 'N4' },
];
const ordered = [
  { ...grammarLesson, id: 88, lessonNumber: 20, displayOrder: 1 },
  grammarLesson,
  { ...grammarLesson, id: 2, lessonNumber: 1, displayOrder: 30 },
];
describe('Grammar lesson browsing and reading', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'grammar', children: GRAMMAR_ROUTES }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'user', role: 'User' });
  });
  afterEach(() => http.verify());
  async function reader() {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/grammar/9', GrammarLessonReader);
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk(levels));
    return { harness, page };
  }
  it('preserves catalogue ordering and changes levels without stale or duplicate requests', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/grammar', GrammarLessons);
    const old = http.expectOne('/api/v1/lessons?level=N5');
    page.changeLevel('N4');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/grammar?level=N4'));
    expect(old.cancelled).toBe(true);
    http.expectOne('/api/v1/lessons?level=N4').flush(grammarOk(ordered));
    harness.detectChanges();
    const links = harness.routeNativeElement!.querySelectorAll('h3 a');
    expect(Array.from(links).map((link) => link.getAttribute('href'))).toEqual([
      '/grammar/88',
      '/grammar/9',
      '/grammar/2',
    ]);
    const select = harness.routeNativeElement!.querySelector('select')!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      'N5',
      'N4',
      'N3',
      'N2',
      'N1',
    ]);
    expect(
      harness.routeNativeElement!.querySelector('ol')!.classList.contains('sm:grid-cols-2'),
    ).toBe(true);
    page.changeLevel('N4');
    http.expectNone(() => true);
  });
  it('shows catalogue errors, retry and empty states', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/grammar?level=N3', GrammarLessons);
    http.expectOne('/api/v1/lessons?level=N3').error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
    page.retry();
    http.expectOne('/api/v1/lessons?level=N3').flush(grammarOk([]));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('No grammar lessons');
  });
  it('renders all eight blocks, marks and Unicode with real level context and ordered neighbours', async () => {
    const { harness } = await reader();
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    for (const selector of [
      'article h1',
      'article h2',
      'ol li',
      'table thead th',
      'table tbody td',
      'figure [lang="ja"]',
      'figcaption [lang="vi"]',
      'aside',
      'blockquote',
      'hr',
      '.font-bold.italic.underline',
    ])
      expect(element.querySelector(selector)).not.toBeNull();
    expect(element.textContent).toContain('𠮷');
    expect(element.textContent).toContain('Tôi là học sinh.');
    expect(element.querySelector('[rel="prev"]')?.getAttribute('href')).toBe('/grammar/88');
    expect(element.querySelector('[rel="next"]')?.getAttribute('href')).toBe('/grammar/2');
    expect(
      element.querySelector('[aria-label="Breadcrumb"] a[href="/grammar?level=N5"]'),
    ).not.toBeNull();
    expect(element.querySelector('input, textarea, [contenteditable]')).toBeNull();
    expect(
      element
        .querySelector('[aria-label="Grammar table"][tabindex="0"]')!
        .classList.contains('overflow-x-auto'),
    ).toBe(true);
  });
  it('reuses the reader on next navigation and hides the stale lesson while fetching', async () => {
    const { harness, page } = await reader();
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    harness.detectChanges();
    await harness.navigateByUrl('/grammar/2', GrammarLessonReader);
    expect(page.state().status).toBe('loading');
    http.expectOne('/api/v1/lessons/2').flush(grammarOk({ ...ordered[2], title: 'Next lesson' }));
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk(levels));
    http
      .expectOne('/api/v1/lessons/2/content')
      .flush(grammarOk({ ...grammarResponseFixture(), lessonId: 2 }));
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('h1')!.textContent).toContain('Next lesson');
    expect(harness.routeNativeElement!.querySelector('[rel="next"]')).toBeNull();
  });
  it('shows missing and empty saved content without treating the lesson as missing', async () => {
    const { harness, page } = await reader();
    http.expectOne('/api/v1/lessons/9/content').flush(
      {
        success: false,
        error: { code: 'LESSON_CONTENT_NOT_FOUND', message: 'Missing', details: [] },
        meta: grammarMeta,
      },
      { status: 404, statusText: 'Not found' },
    );
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk([grammarLesson]));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('not available for this lesson yet');
    page.retryContent();
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk(grammarResponseFixture(1, { blocks: [] })));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('no grammar content yet');
    http.expectNone('/api/v1/lessons/9');
  });
  it('keeps content visible when navigation fails and retries navigation separately', async () => {
    const { harness, page } = await reader();
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
    http.expectOne('/api/v1/lessons?level=N5').error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('figure')).not.toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('Retry navigation');
    page.retryNavigation();
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    http.expectNone('/api/v1/lessons/9/content');
  });
  it('rejects unsupported schemas and recovers with content-only retry', async () => {
    const { harness, page } = await reader();
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk({ ...grammarResponseFixture(), schemaVersion: 2 }));
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('unsupported grammar schema');
    page.retryContent();
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
  });
  it.each([401, 403])('shows safe access feedback for content HTTP %s', async (status) => {
    const { harness } = await reader();
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(null, { status, statusText: 'Access denied' });
    http.expectOne('/api/v1/lessons?level=N5').flush(grammarOk(ordered));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain(
      status === 401 ? 'sign in again' : 'permission',
    );
    expect(TestBed.inject(AuthSession).authenticated()).toBe(true);
  });
  it('rejects invalid IDs without data requests and handles missing metadata', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/grammar/invalid');
    expect(harness.routeNativeElement!.textContent).toContain('Invalid lesson ID');
    http.expectNone(() => true);
    await harness.navigateByUrl('/grammar/9');
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk(levels));
    http.expectOne('/api/v1/lessons/9').flush(null, { status: 404, statusText: 'Not found' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('no longer available');
    http.expectNone('/api/v1/lessons/9/content');
  });
});
