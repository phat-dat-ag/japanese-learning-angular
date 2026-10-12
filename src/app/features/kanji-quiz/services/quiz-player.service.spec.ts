import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { config, created, meta, success } from '../testing/quiz-player.fixture';
import { QuizPlayerService } from './quiz-player.service';

describe('QuizPlayerService', () => {
  let service: QuizPlayerService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(QuizPlayerService);
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'user', username: 'Learner', role: 'User' });
  });
  afterEach(() => http.verify());

  it('loads authenticated configuration and preserves metadata', () => {
    const next = vi.fn();
    service.getConfig().subscribe(next);
    const request = http.expectOne('/api/v1/kanji-quiz/config');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    request.flush(success(config));
    expect(next).toHaveBeenCalledWith(success(config));
  });

  it.each([{ questionCount: 1 }, { levelId: 1, lessonId: 10, questionCount: 3 }])(
    'creates an authenticated session with only the requested settings: %o',
    (body) => {
      const next = vi.fn();
      service.createSession(body).subscribe(next);
      const request = http.expectOne('/api/v1/kanji-quiz/sessions');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);
      expect(request.request.headers.get('Authorization')).toBe('Bearer access');
      request.flush(success(created));
      expect(next).toHaveBeenCalledWith(success(created));
    },
  );

  it.each([
    { ...config, totalQuestions: -1 },
    { ...config, maxQuestionCount: 101 },
    { ...config, levels: [{ ...config.levels[0], id: '1' }] },
    { ...config, lessons: [{ ...config.lessons[0], questionCount: 0 }] },
  ])('rejects malformed configuration', (data) => {
    const error = vi.fn();
    service.getConfig().subscribe({ error });
    http.expectOne('/api/v1/kanji-quiz/config').flush(success(data));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE', meta });
  });

  it('accepts an empty bank', () => {
    const next = vi.fn();
    const empty = { ...config, totalQuestions: 0, levels: [], lessons: [] };
    service.getConfig().subscribe(next);
    http.expectOne('/api/v1/kanji-quiz/config').flush(success(empty));
    expect(next).toHaveBeenCalledWith(success(empty));
  });

  it('rejects an unsafe session ID', () => {
    const error = vi.fn();
    service.createSession({ questionCount: 1 }).subscribe({ error });
    http
      .expectOne('/api/v1/kanji-quiz/sessions')
      .flush(success({ ...created, sessionId: Number.MAX_SAFE_INTEGER + 1 }));
    expect(error.mock.calls[0][0]).toBeInstanceOf(ApiError);
    expect(error.mock.calls[0][0].code).toBe('INVALID_RESPONSE');
  });

  it('preserves normalized conflicts without automatically resubmitting', () => {
    const error = vi.fn();
    service.createSession({ questionCount: 1 }).subscribe({ error });
    http.expectOne('/api/v1/kanji-quiz/sessions').flush(
      {
        success: false,
        error: {
          code: 'QUIZ_INSUFFICIENT_QUESTIONS',
          message: 'Not enough questions',
          details: [],
        },
        meta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(error.mock.calls[0][0]).toMatchObject({
      code: 'QUIZ_INSUFFICIENT_QUESTIONS',
      status: 409,
      meta,
    });
    http.expectNone('/api/v1/kanji-quiz/sessions');
  });
});
