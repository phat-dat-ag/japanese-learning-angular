import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../../../core/api/api-error';
import { API_CONFIG } from '../../../../core/api/api.config';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../../core/auth/auth.interceptor';
import { QuizQuestionService } from './quiz-question.service';
import { importMeta as meta, importResultFixture } from '../testing/quiz-import-result.fixture';

const url = '/gateway/api/v1/admin/kanji-quiz/questions/import';
const file = new File([' [ { "content": {} } ]\n'], 'unchanged.json', {
  type: 'application/json',
  lastModified: 123,
});

describe('Quiz multipart import transport', () => {
  let http: HttpTestingController;
  let service: QuizQuestionService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { baseUrl: '/gateway/api/', timeoutMs: 15000 } },
      ],
    });
    TestBed.inject(AuthSession).replace({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 60,
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(QuizQuestionService);
  });
  afterEach(() => http.verify());

  it('posts the original File with its filename and JWT, letting the browser set the multipart boundary', () => {
    const next = vi.fn();
    service.importQuestions(file).subscribe(next);
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    const body: unknown = request.request.body;
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) throw new Error('Expected multipart form');
    expect(Array.from(body.keys())).toEqual(['file']);
    expect(body.get('file')).toBe(file);
    request.flush({ success: true, data: importResultFixture(), meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: importResultFixture(), meta });
  });
  it.each([
    ['IMPORTED', 'IMPORTED'],
    ['IMPORTED', 'FAILED'],
    ['FAILED', 'FAILED'],
  ] as const)('accepts item results %s / %s without retrying', (first, second) => {
    const next = vi.fn();
    const data = importResultFixture([first, second]);
    service.importQuestions(file).subscribe(next);
    http.expectOne(url).flush({ success: true, data, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data, meta });
    http.expectNone(url);
  });
  it.each([
    {},
    { ...importResultFixture(), imported: 0 },
    { ...importResultFixture(), total: 2 },
    { ...importResultFixture(), results: [{ index: 0, status: 'IMPORTED', questionId: 1 }] },
    {
      ...importResultFixture(),
      results: [{ index: 0, status: 'IMPORTED', questionId: 1, version: 0, errors: [] }],
    },
    { total: 1, imported: 0, failed: 1, results: [{ index: 0, status: 'FAILED', errors: [] }] },
    {
      total: 1,
      imported: 0,
      failed: 1,
      results: [{ index: 0, status: 'FAILED', errors: [{ field: 'x', message: 'x' }] }],
    },
    {
      ...importResultFixture(),
      results: [{ index: 2, status: 'IMPORTED', questionId: 1, version: 0 }],
    },
    {
      ...importResultFixture(['IMPORTED', 'IMPORTED']),
      results: [importResultFixture().results[0], importResultFixture().results[0]],
    },
  ])('rejects malformed or inconsistent server results', (data) => {
    const error = vi.fn();
    service.importQuestions(file).subscribe({ error });
    http.expectOne(url).flush({ success: true, data, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
    http.expectNone(url);
  });
  it.each([400, 403, 413, 500])('preserves normalized request error %s and metadata', (status) => {
    const error = vi.fn();
    service.importQuestions(file).subscribe({ error });
    const details = [{ field: 'file', message: 'File rejected' }];
    http.expectOne(url).flush(
      {
        success: false,
        error: { code: 'QUIZ_IMPORT_INVALID', message: 'Rejected', details },
        meta,
      },
      { status, statusText: 'Error' },
    );
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status, details, meta }));
    expect(error).toHaveBeenCalledWith(expect.any(ApiError));
    http.expectNone(url);
  });
  it('uses the existing token refresh flow on 401 while preserving the same multipart payload', () => {
    service.importQuestions(file).subscribe();
    const first = http.expectOne(url);
    const body = first.request.body;
    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/gateway/api/auth/refresh')
      .flush({ accessToken: 'rotated', refreshToken: 'new-refresh', expiresIn: 60 });
    const retry = http.expectOne(url);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer rotated');
    expect(retry.request.body).toBe(body);
    expect(retry.request.headers.has('Content-Type')).toBe(false);
    retry.flush({ success: true, data: importResultFixture(), meta });
  });
});
