import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client.service';
import { ApiError } from './api-error';
import { API_CONFIG } from './api.config';

const meta = {
  timestamp: '2026-09-14T08:11:32.440598600Z',
  traceId: 'trace-123',
  correlationId: 'correlation-123',
};
const failure = {
  success: false,
  error: {
    code: 'FLASHCARD_VALIDATION_ERROR',
    message: 'Invalid flashcard request',
    details: [{ field: 'level', message: 'Level must be one of N1, N2, N3, N4, N5' }],
  },
  meta,
};
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: '/api/v1/', timeoutMs: 1000 } },
      ],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('returns validated data and response metadata', () => {
    const next = vi.fn();
    client.get('/levels', isStrings).subscribe(next);
    const request = http.expectOne('/api/v1/levels');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ success: true, data: ['N5'], meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: ['N5'], meta });
  });

  it.each([200, 400, 500])('preserves structured API errors with HTTP status %s', (status) => {
    const error = vi.fn();
    client.get('levels', isStrings).subscribe({ error });
    http.expectOne('/api/v1/levels').flush(failure, { status, statusText: 'Response' });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: failure.error.code,
        message: failure.error.message,
        details: failure.error.details,
        meta,
        status,
      }),
    );
    expect(error.mock.calls[0][0]).toBeInstanceOf(ApiError);
  });

  it.each([
    null,
    { success: true, data: ['N5'] },
    { success: 'true', data: ['N5'], meta },
    { success: false, error: { code: 'BAD', message: 'Bad', details: [{}] }, meta },
    { success: true, data: [5], meta },
  ])('rejects malformed envelopes or data: %j', (body) => {
    const error = vi.fn();
    client.get('levels', isStrings).subscribe({ error });
    http.expectOne('/api/v1/levels').flush(body);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it('normalizes network failures', () => {
    const error = vi.fn();
    client.get('levels', isStrings).subscribe({ error });
    http.expectOne('/api/v1/levels').error(new ProgressEvent('error'));
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NETWORK_ERROR', status: 0 }),
    );
  });

  it('does not expose an unstructured server response as the error message', () => {
    const error = vi.fn();
    client.get('levels', isStrings).subscribe({ error });
    http.expectOne('/api/v1/levels').flush('internal server diagnostic', {
      status: 502,
      statusText: 'Bad Gateway',
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HTTP_ERROR', status: 502 }),
    );
    expect(error.mock.calls[0][0].message).not.toContain('internal server diagnostic');
  });

  it('times out and cancels a stalled request', () => {
    vi.useFakeTimers();
    const error = vi.fn();
    client.get('levels', isStrings).subscribe({ error });
    const request = http.expectOne('/api/v1/levels');
    vi.advanceTimersByTime(1000);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_TIMEOUT' }));
    expect(request.cancelled).toBe(true);
  });
});
