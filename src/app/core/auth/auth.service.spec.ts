import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../api/api.config';
import { AuthApi } from './auth-api.service';
import { AuthSession } from './auth-session.service';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

const first = { accessToken: 'access-first', refreshToken: 'refresh-first', expiresIn: 60 };
const rotated = { accessToken: 'access-rotated', refreshToken: 'refresh-rotated', expiresIn: 60 };
const user = {
  userId: 'user-id',
  username: 'learner',
  email: 'learner@example.test',
  role: 'User',
};

describe('Authentication through the Gateway', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  let session: AuthSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    session = TestBed.inject(AuthSession);
  });
  afterEach(() => http.verify());

  it('logs in using the actual plain JSON contract and loads authoritative /me data', () => {
    const localWrite = vi.spyOn(Storage.prototype, 'setItem');
    const next = vi.fn();
    auth.login({ email: user.email, password: 'test-password' }).subscribe(next);
    const login = http.expectOne('/api/auth/login');
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({ email: user.email, password: 'test-password' });
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(first);
    const me = http.expectOne('/api/auth/me');
    expect(me.request.headers.get('Authorization')).toBe('Bearer access-first');
    me.flush(user);
    expect(next).toHaveBeenCalledWith(user);
    expect(session.user()).toEqual(user);
    expect(session.tokens()).toEqual({
      accessToken: first.accessToken,
      refreshToken: first.refreshToken,
      expiresAt: expect.any(Number),
    });
    expect(localWrite).not.toHaveBeenCalled();
    localWrite.mockRestore();
  });

  it.each([401, 403])('keeps login HTTP %s distinct without recursive refresh', (status) => {
    const error = vi.fn();
    auth.login({ email: user.email, password: 'test-password' }).subscribe({ error });
    http.expectOne('/api/auth/login').flush({}, { status, statusText: 'Rejected' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(session.tokens()).toBeNull();
    http.expectNone('/api/auth/refresh');
  });

  it.each([
    { ...first, accessToken: '' },
    { ...first, refreshToken: ' ' },
    { ...first, expiresIn: 0 },
    { success: true, data: first },
  ])('rejects invalid token responses', (body) => {
    const error = vi.fn();
    auth.login({ email: user.email, password: 'test-password' }).subscribe({ error });
    http.expectOne('/api/auth/login').flush(body);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
    expect(session.tokens()).toBeNull();
  });

  it('adds Bearer while preserving existing headers', () => {
    session.replace(first);
    client
      .get('/api/v1/jlpt-levels', {
        headers: { Accept: 'application/json', 'X-Correlation-ID': 'test-id' },
      })
      .subscribe();
    const request = http.expectOne('/api/v1/jlpt-levels');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-first');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.headers.get('X-Correlation-ID')).toBe('test-id');
    request.flush({});
  });

  it('does not attach an absent token or refresh an anonymous 401', () => {
    const error = vi.fn();
    client.get('/api/v1/jlpt-levels').subscribe({ error });
    const request = http.expectOne('/api/v1/jlpt-levels');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectNone('/api/auth/refresh');
  });

  it.each([
    'https://third-party.example/api/data',
    '//third-party.example/api/data',
    '/api-other/data',
    '/assets/logo.svg',
    '/api/../outside',
  ])('does not leak tokens to %s', (url) => {
    session.replace(first);
    client.get(url).subscribe({ error: vi.fn() });
    const request = http.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectNone('/api/auth/refresh');
    expect(session.authenticated()).toBe(true);
  });

  it('rotates once for concurrent 401s and retries both requests once', () => {
    session.replace(first);
    client.get('/api/one').subscribe();
    client.get('/api/two').subscribe();
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/two').flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne('/api/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-first' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(rotated);
    for (const url of ['/api/one', '/api/two']) {
      const retry = http.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-rotated');
      retry.flush({});
    }
    expect(session.tokens()?.refreshToken).toBe('refresh-rotated');
  });

  it('reuses a completed rotation for a late 401 from the old token', () => {
    session.replace(first);
    client.get('/api/one').subscribe();
    client.get('/api/two').subscribe();
    const second = http.expectOne('/api/two');
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(rotated);
    http.expectOne('/api/one').flush({});
    second.flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = http.expectOne('/api/two');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-rotated');
    retry.flush({});
    http.expectNone('/api/auth/refresh');
  });

  it('does not retry a second 401 and clears the rejected session', () => {
    session.replace(first);
    const error = vi.fn();
    client.get('/api/one').subscribe({ error });
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(rotated);
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(session.tokens()).toBeNull();
    http.expectNone('/api/auth/refresh');
  });

  it.each([401, 500])('clears tokens/user when refresh fails with %s', (status) => {
    session.replace(first);
    session.setUser(user);
    client.get('/api/one').subscribe({ error: vi.fn() });
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status, statusText: 'Failed' });
    expect(session.tokens()).toBeNull();
    expect(session.user()).toBeNull();
    http.expectNone('/api/auth/refresh');
    http.expectNone('/api/one');
  });

  it('keeps the session and does not refresh on 403', () => {
    session.replace(first);
    const error = vi.fn();
    client.get('/api/admin').subscribe({ error });
    http.expectOne('/api/admin').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(session.tokens()?.accessToken).toBe(first.accessToken);
    http.expectNone('/api/auth/refresh');
  });

  it.each([204, 401, 500])(
    'revokes using the logout contract and clears locally on HTTP %s',
    (status) => {
      session.replace(first);
      session.setUser(user);
      auth.logout().subscribe({ error: vi.fn() });
      const logout = http.expectOne('/api/auth/logout');
      expect(logout.request.method).toBe('POST');
      expect(logout.request.body).toEqual({ refreshToken: first.refreshToken });
      expect(logout.request.headers.has('Authorization')).toBe(false);
      expect(session.tokens()).toBeNull();
      logout.flush(null, { status, statusText: 'Response' });
      expect(session.user()).toBeNull();
      http.expectNone('/api/auth/refresh');
    },
  );

  it('waits for in-flight rotation on logout and revokes the new refresh token', () => {
    session.replace(first);
    client.get('/api/one').subscribe({ error: vi.fn() });
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    auth.logout().subscribe();
    expect(session.authenticated()).toBe(false);
    http.expectOne('/api/auth/refresh').flush(rotated);
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.body).toEqual({ refreshToken: rotated.refreshToken });
    logout.flush(null, { status: 204, statusText: 'No Content' });
    expect(session.tokens()).toBeNull();
    http.expectNone('/api/one');
  });

  it('rejects malformed refresh responses and clears the session', () => {
    session.replace(first);
    auth.refresh().subscribe({ error: vi.fn() });
    http.expectOne('/api/auth/refresh').flush({ ...rotated, refreshToken: null });
    expect(session.tokens()).toBeNull();
  });

  it('does not restore tokens when a session is cleared during refresh', () => {
    session.replace(first);
    auth.refresh().subscribe({ error: vi.fn() });
    const refresh = http.expectOne('/api/auth/refresh');
    session.clear();
    refresh.flush(rotated);
    expect(session.tokens()).toBeNull();
  });

  it('does not let an old request clear or refresh a replacement session', () => {
    session.replace(first);
    client.get('/api/one').subscribe({ error: vi.fn() });
    const request = http.expectOne('/api/one');
    session.clear();
    session.replace(rotated);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectNone('/api/auth/refresh');
    expect(session.tokens()?.accessToken).toBe(rotated.accessToken);
  });

  it('reports a failed rotation during logout while clearing local state', () => {
    session.replace(first);
    auth.refresh().subscribe({ error: vi.fn() });
    const error = vi.fn();
    auth.logout().subscribe({ error });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(session.tokens()).toBeNull();
    expect(auth.busy()).toBe(false);
  });

  it('rejects invalid /me data and clears an incomplete login', () => {
    const error = vi.fn();
    auth.login({ email: user.email, password: 'test-password' }).subscribe({ error });
    http.expectOne('/api/auth/login').flush(first);
    http.expectOne('/api/auth/me').flush({ userId: 123 });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
    expect(session.tokens()).toBeNull();
  });

  it('allows retrying a later request to rotate the current refresh token', () => {
    session.replace(first);
    auth.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush(rotated);
    auth.refresh().subscribe();
    const second = http.expectOne('/api/auth/refresh');
    expect(second.request.body).toEqual({ refreshToken: rotated.refreshToken });
    second.flush({ ...first, refreshToken: 'refresh-third' });
  });

  it('finishes rotation when the original subscriber cancels', () => {
    session.replace(first);
    const subscription = client.get('/api/one').subscribe();
    http.expectOne('/api/one').flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne('/api/auth/refresh');
    subscription.unsubscribe();
    expect(refresh.cancelled).toBe(false);
    refresh.flush(rotated);
    expect(session.tokens()?.refreshToken).toBe(rotated.refreshToken);
  });
});

describe('Configured Gateway origin', () => {
  it('scopes Authorization to the exact configured origin and API path', () => {
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
    TestBed.inject(AuthSession).replace(first);
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    for (const [url, authorized] of [
      ['https://gateway.example/api/v1/lessons', true],
      ['https://gateway.example/api-other/lessons', false],
      ['https://gateway.example.evil.test/api/v1/lessons', false],
      ['http://gateway.example/api/v1/lessons', false],
      ['/api/v1/lessons', false],
    ] as const) {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(authorized);
      request.flush({});
    }
    TestBed.inject(AuthApi).refresh(first.refreshToken).subscribe();
    const refresh = http.expectOne('https://gateway.example/api/auth/refresh');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(rotated);
    http.verify();
  });
});
