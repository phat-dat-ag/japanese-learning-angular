import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../../../core/api/api-error';
import { API_CONFIG } from '../../../../core/api/api.config';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../../core/auth/auth.interceptor';
import {
  QuizQuestionContentRequest,
  QuizQuestionCreateRequest,
  QuizQuestionResponse,
} from '../models/quiz-question.model';
import { QuizQuestionService } from './quiz-question.service';

const meta = { timestamp: '2026-10-11T00:00:00Z', traceId: 'trace', correlationId: 'correlation' };
const content: QuizQuestionContentRequest = {
  sourceType: 'CUSTOM',
  sentenceReading: 'がっこう',
  targetStart: 0,
  targetLength: 4,
  targetReading: 'がっこう',
  levelIds: [],
  lessonIds: [],
};
const create: QuizQuestionCreateRequest = {
  content,
  options: [
    { text: '学校', correct: true },
    { text: '学生', correct: false },
    { text: '先生', correct: false },
    { text: '大学', correct: false },
  ],
};
const question: QuizQuestionResponse = {
  ...content,
  id: 42,
  version: 0,
  status: 'DRAFT',
  sourceInvalidated: false,
  eligibleForNewGames: false,
  options: create.options.map((option, index) => ({ ...option, id: index + 1 })),
  createdAt: '2026-10-11T00:00:00',
  updatedAt: '2026-10-11T00:00:00',
};
const base = '/api/v1/admin/kanji-quiz/questions';

describe('QuizQuestionService', () => {
  let service: QuizQuestionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuizQuestionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const operations = [
    {
      name: 'detail',
      method: 'GET',
      suffix: '/42',
      body: null,
      call: (api: QuizQuestionService) => api.getQuestion(42),
    },
    {
      name: 'create CUSTOM',
      method: 'POST',
      suffix: '',
      body: create,
      call: (api: QuizQuestionService) => api.createQuestion(create),
    },
    {
      name: 'replace content',
      method: 'PUT',
      suffix: '/42',
      body: { version: 0, content },
      call: (api: QuizQuestionService) => api.updateQuestion(42, { version: 0, content }),
    },
    {
      name: 'edit option',
      method: 'PUT',
      suffix: '/42/options/2',
      body: { version: 0, text: '生徒' },
      call: (api: QuizQuestionService) => api.updateOption(42, 2, { version: 0, text: '生徒' }),
    },
    {
      name: 'select correct option',
      method: 'PUT',
      suffix: '/42/correct-option',
      body: { version: 0, optionId: 2 },
      call: (api: QuizQuestionService) => api.changeCorrectOption(42, { version: 0, optionId: 2 }),
    },
    {
      name: 'publish',
      method: 'POST',
      suffix: '/42/publish',
      body: { version: 0 },
      call: (api: QuizQuestionService) => api.publishQuestion(42, { version: 0 }),
    },
    {
      name: 'unpublish',
      method: 'POST',
      suffix: '/42/unpublish',
      body: { version: 0 },
      call: (api: QuizQuestionService) => api.unpublishQuestion(42, { version: 0 }),
    },
    {
      name: 'archive',
      method: 'POST',
      suffix: '/42/archive',
      body: { version: 0 },
      call: (api: QuizQuestionService) => api.archiveQuestion(42, { version: 0 }),
    },
  ];

  it.each(operations)(
    '$name uses the documented method, body and envelope',
    ({ call, method, suffix, body }) => {
      const next = vi.fn();
      call(service).subscribe(next);
      const request = http.expectOne(base + suffix);
      expect(request.request.method).toBe(method);
      expect(request.request.body).toEqual(body);
      request.flush({ success: true, data: question, meta });
      expect(next).toHaveBeenCalledWith({ success: true, data: question, meta });
    },
  );

  it('creates EXAMPLE content without a sentenceReading or client-supplied status', () => {
    const exampleContent: QuizQuestionContentRequest = {
      sourceType: 'EXAMPLE',
      exampleId: 9,
      vocabularyId: 7,
      targetStart: 0,
      targetLength: 4,
      targetReading: 'がっこう',
      explanationEn: 'School',
      levelIds: [1],
      lessonIds: [2],
    };
    const next = vi.fn();
    service.createQuestion({ content: exampleContent, options: create.options }).subscribe(next);
    const request = http.expectOne(base);
    expect(request.request.body).toEqual({ content: exampleContent, options: create.options });
    request.flush({
      success: true,
      data: { ...question, ...exampleContent, sourceInvalidated: true },
      meta,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('preserves all filters, Unicode and literal query characters, including page zero', () => {
    const query = {
      sourceType: 'EXAMPLE',
      status: 'PUBLISHED',
      levelId: 1,
      lessonId: 2,
      vocabularyId: 3,
      exampleId: 4,
      keyword: '学校 & +?#',
      page: 0,
      size: 100,
    } as const;
    const next = vi.fn();
    service.listQuestions(query).subscribe(next);
    const request = http.expectOne((request) => request.url.startsWith(base + '?'));
    expect(request.request.method).toBe('GET');
    const params = new URL(request.request.url, 'https://test.invalid').searchParams;
    for (const [key, value] of Object.entries(query)) expect(params.get(key)).toBe(String(value));
    expect([...params.keys()]).toHaveLength(9);
    const data = { items: [question], page: 0, size: 100, totalElements: 1, totalPages: 1 };
    request.flush({ success: true, data, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data, meta });
  });

  it('uses backend paging defaults and accepts an empty page', () => {
    const next = vi.fn();
    service.listQuestions().subscribe(next);
    const data = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    http.expectOne(base).flush({ success: true, data, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data, meta });
  });

  it.each(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)(
    'accepts %s with deleted EXAMPLE source fields omitted',
    (status) => {
      const { sentenceReading, ...detached } = question;
      const data = { ...detached, sourceType: 'EXAMPLE', status, sourceInvalidated: true };
      const next = vi.fn();
      service.getQuestion(42).subscribe(next);
      http.expectOne(base + '/42').flush({ success: true, data, meta });
      expect(next).toHaveBeenCalledWith({ success: true, data, meta });
    },
  );

  it.each([
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { version: -1 },
    { sourceType: 'OTHER' },
    { status: 'DELETED' },
    { targetStart: 0.5 },
    { levelIds: ['1'] },
    { sentenceReading: null },
    { options: [{ id: 1, text: '学校', correct: 'true' }] },
    { eligibleForNewGames: undefined },
  ])('rejects malformed or unsafe question data: %j', (invalid) => {
    const error = vi.fn();
    service.getQuestion(42).subscribe({ error });
    http.expectOne(base + '/42').flush({ success: true, data: { ...question, ...invalid }, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it.each([
    { items: [{}], page: 0, size: 20, totalElements: 1, totalPages: 1 },
    { items: [], page: -1, size: 20, totalElements: 0, totalPages: 0 },
    { items: [], page: 0, size: 20, totalElements: '0', totalPages: 0 },
  ])('rejects malformed list data: %j', (data) => {
    const error = vi.fn();
    service.listQuestions().subscribe({ error });
    http.expectOne(base).flush({ success: true, data, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [400, 'QUIZ_QUESTION_INVALID'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'QUIZ_QUESTION_NOT_FOUND'],
    [404, 'QUIZ_OPTION_NOT_FOUND'],
    [404, 'QUIZ_REFERENCE_NOT_FOUND'],
    [409, 'QUIZ_QUESTION_CONFLICT'],
  ])('preserves HTTP %s %s and backend validation details', (status, code) => {
    const error = vi.fn();
    const details = [{ field: 'content.targetReading', message: 'Invalid target reading' }];
    service.updateQuestion(42, { version: 0, content }).subscribe({ error });
    http.expectOne(base + '/42').flush(
      {
        success: false,
        error: { code, message: 'Question rejected', details },
        meta,
      },
      { status, statusText: 'Rejected' },
    );
    expect(error).toHaveBeenCalledWith(expect.any(ApiError));
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        status,
        code,
        message: 'Question rejected',
        details,
        meta,
      }),
    );
    http.expectNone(() => true);
  });
});

describe('QuizQuestionService shared transport integration', () => {
  it('uses the configured base URL and existing JWT interceptor', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { baseUrl: '/gateway/api/', timeoutMs: 15_000 } },
      ],
    });
    TestBed.inject(AuthSession).replace({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 60,
    });
    const next = vi.fn();
    TestBed.inject(QuizQuestionService).getQuestion(42).subscribe(next);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/gateway/api/v1/admin/kanji-quiz/questions/42');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    request.flush({ success: true, data: question, meta });
    expect(next).toHaveBeenCalledOnce();
    http.verify();
  });
});
