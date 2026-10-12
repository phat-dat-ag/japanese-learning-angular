import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { breakdown, historyDetail, historyPage, progress } from '../testing/quiz-report.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { QuizPlayerService } from './quiz-player.service';

describe('Quiz reporting API', () => {
  let api: QuizPlayerService;
  let http: HttpTestingController;
  const base = '/api/v1/kanji-quiz';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    api = TestBed.inject(QuizPlayerService);
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthSession);
    auth.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    auth.setUser({ userId: 'user', username: 'Learner', role: 'User' });
  });
  afterEach(() => http.verify());

  const operations: readonly {
    path: string;
    data: unknown;
    call: (api: QuizPlayerService) => Observable<unknown>;
  }[] = [
    { path: '/history?page=0&size=20', data: historyPage, call: (api) => api.getHistory() },
    { path: '/history/42', data: historyDetail, call: (api) => api.getHistoryDetail(42) },
    { path: '/progress', data: progress, call: (api) => api.getProgress() },
    { path: '/progress/breakdown', data: breakdown, call: (api) => api.getProgressBreakdown() },
  ];
  for (const operation of operations) {
    it('reads authenticated ' + operation.path + ' and preserves metadata', () => {
      const next = vi.fn();
      operation.call(api).subscribe(next);
      const request = http.expectOne(base + operation.path);
      expect(request.request.method).toBe('GET');
      expect(request.request.body).toBeNull();
      expect(request.request.headers.get('Authorization')).toBe('Bearer access');
      request.flush(success(operation.data));
      expect(next).toHaveBeenCalledWith(success(operation.data));
    });
    it('rejects malformed ' + operation.path, () => {
      const error = vi.fn();
      operation.call(api).subscribe({ error });
      http.expectOne(base + operation.path).flush(success({}));
      expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE', meta });
    });
    it('preserves a normalized failure for ' + operation.path, () => {
      const error = vi.fn();
      operation.call(api).subscribe({ error });
      http.expectOne(base + operation.path).flush(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Denied', details: [] },
          meta,
        },
        { status: 403, statusText: 'Forbidden' },
      );
      expect(error.mock.calls[0][0]).toMatchObject({ code: 'FORBIDDEN', status: 403, meta });
    });
  }

  it('sends only supported history pagination', () => {
    api.getHistory(3, 50).subscribe();
    http
      .expectOne(base + '/history?page=3&size=50')
      .flush(success({ ...historyPage, page: 3, size: 50 }));
  });

  it('rejects a mismatched history session ID', () => {
    const error = vi.fn();
    api.getHistoryDetail(42).subscribe({ error });
    http
      .expectOne(base + '/history/42')
      .flush(success({ ...historyDetail, session: { ...historyDetail.session, sessionId: 73 } }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    { ...historyDetail.questions[0], selectedOptionId: 999 },
    { ...historyDetail.questions[0], correctOptionId: 999 },
    { ...historyDetail.questions[0], targetLength: 100 },
    { ...historyDetail.questions[0], options: [] },
  ])('rejects invalid review snapshots', (question) => {
    const error = vi.fn();
    api.getHistoryDetail(42).subscribe({ error });
    http
      .expectOne(base + '/history/42')
      .flush(success({ ...historyDetail, questions: [question] }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([null, undefined])('accepts null or omitted progress nullable fields: %s', (empty) => {
    const next = vi.fn();
    api.getProgress().subscribe(next);
    http.expectOne(base + '/progress').flush(success({ ...progress, latestCompletedAt: empty }));
    expect(next).toHaveBeenCalled();
    api.getProgressBreakdown().subscribe(next);
    http.expectOne(base + '/progress/breakdown').flush(
      success({
        levels: [{ ...breakdown.levels[2], levelId: empty, lessonId: empty }],
        lessons: [{ ...breakdown.lessons[3], levelId: empty, lessonId: empty }],
      }),
    );
    expect(next).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...breakdown, levels: [{ ...breakdown.levels[0], classification: 'OTHER' }] },
    { ...breakdown, levels: [{ ...breakdown.levels[0], levelId: null }] },
    { ...breakdown, levels: [{ ...breakdown.levels[0], lessonId: 10 }] },
    { ...breakdown, lessons: [{ ...breakdown.lessons[0], lessonId: null }] },
    { ...breakdown, levels: [{ ...breakdown.levels[2], levelId: 1 }] },
    { ...breakdown, levels: [{ ...breakdown.levels[3], accuracyPercentage: 101 }] },
  ])('validates classification dimensions without conflating missing assignments', (data) => {
    const error = vi.fn();
    api.getProgressBreakdown().subscribe({ error });
    http.expectOne(base + '/progress/breakdown').flush(success(data));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
