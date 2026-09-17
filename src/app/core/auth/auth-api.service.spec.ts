import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../api/api.config';
import { AuthApi } from './auth-api.service';
import { AuthSession } from './auth-session.service';
import { authInterceptor } from './auth.interceptor';

const request = { username: 'learner', email: 'learner@example.test', password: 'test-password' };
const response = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'learner',
  email: request.email,
  createdAt: '2026-09-16T00:00:00Z',
};

describe('AuthApi registration', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: API_CONFIG,
          useValue: { baseUrl: 'https://gateway.example/api', timeoutMs: 1000 },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('uses the configured Gateway, omits extra properties, and bypasses Bearer even with a session', () => {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    const next = vi.fn();
    const form = { ...request, confirmPassword: request.password };
    TestBed.inject(AuthApi).register(form).subscribe(next);
    const pending = http.expectOne('https://gateway.example/api/auth/register');
    expect(pending.request.body).toEqual(request);
    expect(pending.request.headers.has('Authorization')).toBe(false);
    pending.flush(response, { status: 201, statusText: 'Created' });
    expect(next).toHaveBeenCalledWith(response);
    expect(session.tokens()?.accessToken).toBe('access');
  });

  it.each([
    {},
    { ...response, id: 123 },
    { ...response, createdAt: 'invalid' },
    { ...response, username: '' },
  ])('rejects malformed registration success bodies', (body) => {
    const error = vi.fn();
    TestBed.inject(AuthApi).register(request).subscribe({ error });
    http.expectOne('https://gateway.example/api/auth/register').flush(body);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it('preserves .NET validation details and trace ID without surfacing diagnostics as the message', () => {
    const error = vi.fn();
    TestBed.inject(AuthApi).register(request).subscribe({ error });
    http.expectOne('https://gateway.example/api/auth/register').flush(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'private diagnostic',
          details: [{ field: 'Username', message: 'Required' }],
        },
        traceId: 'trace-id',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        traceId: 'trace-id',
        details: [{ field: 'Username', message: 'Required' }],
      }),
    );
    expect(error.mock.calls[0][0].message).not.toContain('private diagnostic');
  });

  it('uses the configured timeout', () => {
    vi.useFakeTimers();
    const error = vi.fn();
    TestBed.inject(AuthApi).register(request).subscribe({ error });
    const pending = http.expectOne('https://gateway.example/api/auth/register');
    vi.advanceTimersByTime(1001);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_TIMEOUT' }));
    expect(pending.cancelled).toBe(true);
  });
  it('preserves existing Gateway error metadata', () => {
    const error = vi.fn();
    const meta = {
      timestamp: '2026-09-16T00:00:00Z',
      traceId: 'trace',
      correlationId: 'correlation',
    };
    TestBed.inject(AuthApi).register(request).subscribe({ error });
    http.expectOne('https://gateway.example/api/auth/register').flush(
      {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Unavailable', details: [] },
        meta,
      },
      { status: 503, statusText: 'Unavailable' },
    );
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAVAILABLE', meta }));
  });

  it('falls back safely when .NET error details are malformed', () => {
    const error = vi.fn();
    TestBed.inject(AuthApi).register(request).subscribe({ error });
    http.expectOne('https://gateway.example/api/auth/register').flush(
      {
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Diagnostic', details: [42] },
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'HTTP_ERROR' }));
  });
});
