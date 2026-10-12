import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import {
  answer,
  completion,
  nextQuestion,
  question,
  session,
} from '../testing/quiz-gameplay.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { QuizPlayerService } from './quiz-player.service';

describe('Quiz gameplay API', () => {
  let service: QuizPlayerService;
  let http: HttpTestingController;
  const base = '/api/v1/kanji-quiz/sessions/42';
  const request = { sessionQuestionId: 101, selectedOptionId: 402 };
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
    const auth = TestBed.inject(AuthSession);
    auth.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    auth.setUser({ userId: 'user', username: 'Learner', role: 'User' });
  });
  afterEach(() => http.verify());

  const operations: readonly {
    name: string;
    method: string;
    suffix: string;
    body: typeof request | null;
    data: typeof session | typeof nextQuestion | typeof answer | typeof completion;
    call: (api: QuizPlayerService) => Observable<unknown>;
  }[] = [
      {
        name: 'session',
        method: 'GET',
        suffix: '',
        body: null,
        data: session,
        call: (api: QuizPlayerService) => api.getSession(42),
      },
      {
        name: 'next',
        method: 'GET',
        suffix: '/next',
        body: null,
        data: nextQuestion,
        call: (api: QuizPlayerService) => api.getNextQuestion(42),
      },
      {
        name: 'answer',
        method: 'POST',
        suffix: '/answers',
        body: request,
        data: answer,
        call: (api: QuizPlayerService) => api.submitAnswer(42, request),
      },
      {
        name: 'finish',
        method: 'POST',
        suffix: '/finish',
        body: null,
        data: completion,
        call: (api: QuizPlayerService) => api.finishSession(42),
      },
    ];
  for (const operation of operations) {
    it('uses the authenticated ' + operation.name + ' contract and preserves metadata', () => {
      const next = vi.fn();
      operation.call(service).subscribe(next);
      const pending = http.expectOne(base + operation.suffix);
      expect(pending.request.method).toBe(operation.method);
      expect(pending.request.body).toEqual(operation.body);
      expect(pending.request.headers.get('Authorization')).toBe('Bearer access');
      pending.flush(success(operation.data));
      expect(next).toHaveBeenCalledWith(success(operation.data));
    });
    it('rejects mismatched identity in ' + operation.name + ' responses', () => {
      const error = vi.fn();
      operation.call(service).subscribe({ error });
      http.expectOne(base + operation.suffix).flush(
        success({
          ...operation.data,
          sessionId: 99,
          sessionQuestionId: 99,
        }),
      );
      expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE', meta });
    });
    it('preserves normalized ' + operation.name + ' failures without retrying', () => {
      const error = vi.fn();
      operation.call(service).subscribe({ error });
      http.expectOne(base + operation.suffix).flush(
        {
          success: false,
          error: { code: 'QUIZ_CONFLICT', message: 'Conflict', details: [] },
          meta,
        },
        { status: 409, statusText: 'Conflict' },
      );
      expect(error.mock.calls[0][0]).toMatchObject({ code: 'QUIZ_CONFLICT', status: 409, meta });
      http.expectNone(base + operation.suffix);
    });
  }

  it.each([
    { ...question, options: question.options.slice(0, 3) },
    { ...question, options: [...question.options, question.options[0]] },
    {
      ...question,
      options: [question.options[0], question.options[0], ...question.options.slice(2)],
    },
    { ...question, targetStart: 7 },
    { ...question, targetLength: 0 },
    { ...question, targetLength: 1.5 },
    { ...question, targetStart: 1, targetLength: 6 },
    { ...question, sessionQuestionId: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects unsafe question data', (data) => {
    const error = vi.fn();
    service.getNextQuestion(42).subscribe({ error });
    http.expectOne(base + '/next').flush(success({ ...nextQuestion, question: data }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each(['IN_PROGRESS', 'COMPLETED', 'ABANDONED'])(
    'accepts an explicit null question for %s',
    (status) => {
      const next = vi.fn();
      service.getNextQuestion(42).subscribe(next);
      http.expectOne(base + '/next').flush(success({ ...nextQuestion, status, question: null }));
      expect(next).toHaveBeenCalled();
    },
  );

  it('rejects a missing question field', () => {
    const error = vi.fn();
    service.getNextQuestion(42).subscribe({ error });
    http.expectOne(base + '/next').flush(success({ sessionId: 42, status: 'IN_PROGRESS' }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([{}, { explanationVi: null, explanationEn: null }])(
    'accepts omitted or null explanations',
    (explanations) => {
      const next = vi.fn();
      service.submitAnswer(42, request).subscribe(next);
      const { explanationVi, explanationEn, ...feedback } = answer;
      http.expectOne(base + '/answers').flush(success({ ...feedback, ...explanations }));
      expect(next).toHaveBeenCalled();
    },
  );

  it('rejects malformed feedback', () => {
    const error = vi.fn();
    service.submitAnswer(42, request).subscribe({ error });
    http.expectOne(base + '/answers').flush(success({ ...answer, correct: 'true' }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects invalid completion totals', () => {
    const error = vi.fn();
    service.finishSession(42).subscribe({ error });
    http.expectOne(base + '/finish').flush(success({ ...completion, incorrectCount: 10 }));
    expect(error.mock.calls[0][0]).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
