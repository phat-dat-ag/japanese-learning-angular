import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject } from 'rxjs';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { LESSON_ROUTES } from '../lesson.routes';
import { GrammarImportPreview } from '../models/lesson-import.model';
import { LessonContentImportService } from '../services/lesson-content-import.service';
import { grammarMeta, grammarOk } from '../testing/grammar-content.fixture';
import {
  grammarImportItemFixture,
  grammarImportReportFixture,
} from '../testing/lesson-import.fixture';
import { LessonImport } from './lesson-import';

describe('Complete grammar JSON import page', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/lessons', children: LESSON_ROUTES }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'admin', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function setup() {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons/import', LessonImport);
    return { harness, page };
  }
  function choose(
    harness: RouterTestingHarness,
    file = new File([JSON.stringify([grammarImportItemFixture()])], 'complete.json', {
      type: 'application/json',
    }),
  ) {
    const input =
      harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: { item: () => file } });
    input.dispatchEvent(new Event('change'));
    harness.detectChanges();
    return file;
  }
  async function ready(harness: RouterTestingHarness, page: LessonImport) {
    await vi.waitFor(() => expect(page.preview().status).toBe('ready'));
    harness.detectChanges();
  }
  it('validates files before enabling submission and provides both import routes', async () => {
    const { harness, page } = await setup();
    expect(page.canSubmit()).toBe(false);
    expect(
      harness.routeNativeElement?.querySelector('a[href="/admin/lessons/import/metadata"]'),
    ).not.toBeNull();
    choose(harness, new File(['{}'], 'invalid.json'));
    await vi.waitFor(() => expect(page.preview().status).toBe('error'));
    page.submit();
    http.expectNone(() => true);
    choose(harness);
    await ready(harness, page);
    expect(page.canSubmit()).toBe(true);
  });
  it.each(['SKIP_EXISTING', 'UPDATE_EXISTING'] as const)(
    'uploads once in %s and renders all partial results with one-based indices',
    async (mode) => {
      const { harness, page } = await setup();
      const file = choose(harness);
      await ready(harness, page);
      page.changeMode(mode);
      page.submit();
      page.submit();
      expect(page.canLeave()).toBe(false);
      const event = new Event('beforeunload', { cancelable: true });
      page.beforeUnload(event as BeforeUnloadEvent);
      expect(event.defaultPrevented).toBe(true);
      const request = http.expectOne(`/api/v1/lessons/content/import?mode=${mode}`);
      expect(request.request.body.get('file')).toBe(file);
      page.changeMode(mode === 'SKIP_EXISTING' ? 'UPDATE_EXISTING' : 'SKIP_EXISTING');
      expect(page.mode()).toBe(mode);
      request.flush(grammarOk(grammarImportReportFixture()));
      harness.detectChanges();
      expect(page.outcome()?.report.results[0].index).toBe(0);
      const text = harness.routeNativeElement!.textContent!;
      for (const expected of [
        'Created: 1',
        'Updated: 1',
        'Skipped: 1',
        'Failed: 1',
        'Item 1:',
        'Item 4:',
        'CREATED',
        'UPDATED',
        'SKIPPED',
        'FAILED',
        'LESSON_CONTENT_CONFLICT',
        'Content revision does not match.',
      ])
        expect(text).toContain(expected);
      expect(page.canSubmit()).toBe(false);
      page.submit();
      http.expectNone(() => true);
      expect(page.canLeave()).toBe(true);
    },
  );
  it('distinguishes server whole-file rejection and displays safe validation details', async () => {
    const { harness, page } = await setup();
    choose(harness);
    await ready(harness, page);
    page.submit();
    http.expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING').flush(
      {
        success: false,
        error: {
          code: 'LESSON_CONTENT_INVALID',
          message: 'Invalid grammar file',
          details: [{ field: '[0].content', message: 'Invalid block' }],
        },
        meta: grammarMeta,
      },
      { status: 400, statusText: 'Bad request' },
    );
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Whole-file rejection');
    expect(harness.routeNativeElement!.textContent).toContain('[0].content: Invalid block');
    expect(page.outcome()).toBeNull();
  });
  it.each([0, 500, 200])('handles uncertain outcomes (%s) without retrying', async (status) => {
    const { harness, page } = await setup();
    choose(harness);
    await ready(harness, page);
    page.submit();
    const request = http.expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING');
    if (status === 0) request.error(new ProgressEvent('error'));
    else if (status === 200) request.flush(grammarOk({ total: 1 }));
    else request.flush(null, { status, statusText: 'Failure' });
    expect(page.feedback()?.kind).toBe('uncertain');
    expect(page.feedback()?.message).toContain('already have been committed');
    expect(page.canSubmit()).toBe(false);
    page.submit();
    http.expectNone(() => true);
  });
  it('blocks navigation during an upload', async () => {
    const { harness, page } = await setup();
    choose(harness);
    await ready(harness, page);
    page.submit();
    const request = http.expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING');
    await harness.navigateByUrl('/admin/lessons/import/metadata');
    expect(TestBed.inject(Router).url).toBe('/admin/lessons/import');
    request.error(new ProgressEvent('error'));
    expect(page.feedback()?.kind).toBe('uncertain');
    expect(page.consumed()).toBe(true);
  });
  it('preserves timeout uncertainty without resubmitting', async () => {
    const { harness, page } = await setup();
    choose(harness);
    await ready(harness, page);
    vi.useFakeTimers();
    page.submit();
    const request = http.expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING');
    vi.advanceTimersByTime(15001);
    expect(request.cancelled).toBe(true);
    expect(page.feedback()?.kind).toBe('uncertain');
    expect(page.consumed()).toBe(true);
    page.submit();
    http.expectNone(() => true);
  });
  it('checks Admin authorization again and keeps session on a backend 403', async () => {
    const { harness, page } = await setup();
    choose(harness);
    await ready(harness, page);
    const session = TestBed.inject(AuthSession);
    session.setUser({ userId: 'user', username: 'User', role: 'User' });
    page.submit();
    http.expectNone(() => true);
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
    page.submit();
    http
      .expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    expect(session.authenticated()).toBe(true);
    expect(page.feedback()?.message).toContain('Admin');
  });
  it('cancels stale file reads and ignores their delayed validation result', async () => {
    const first = new Subject<GrammarImportPreview>();
    const second = new Subject<GrammarImportPreview>();
    const cancelled = vi.fn();
    vi.spyOn(TestBed.inject(LessonContentImportService), 'preview')
      .mockReturnValueOnce(
        new Observable((subscriber) => {
          const subscription = first.subscribe(subscriber);
          return () => {
            cancelled();
            subscription.unsubscribe();
          };
        }),
      )
      .mockReturnValueOnce(second);
    const { harness, page } = await setup();
    choose(harness);
    choose(harness, new File(['{}'], 'second.json'));
    first.next({ status: 'ready', count: 1 });
    expect(cancelled).toHaveBeenCalled();
    expect(page.preview().status).toBe('reading');
    second.next({ status: 'error', issues: ['Second file invalid'] });
    expect(page.preview()).toEqual({ status: 'error', issues: ['Second file invalid'] });
    expect(page.canSubmit()).toBe(false);
  });
});
