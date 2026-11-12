import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from './auth-session.service';
import { authInterceptor } from './auth.interceptor';

describe('API correlation without authentication changes', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  for (const incoming of ['valid_id-1', '', 'invalid value', 'a'.repeat(65)]) {
    it(`validates inbound correlation (${incoming.length}) without exposing credentials`, () => {
      http
        .post(
          '/api/auth/login?private=sentinel',
          { password: 'password-sentinel' },
          {
            headers: { 'X-Correlation-ID': incoming },
          },
        )
        .subscribe();

      const request = controller.expectOne('/api/auth/login?private=sentinel');
      const id = request.request.headers.get('X-Correlation-ID');

      expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);

      if (incoming === 'valid_id-1')
        expect(id).toBe(incoming);

      expect(request.request.body).toEqual({ password: 'password-sentinel' });
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(id).not.toContain('sentinel');

      request.flush({});
    });
  }

  it('creates independent IDs and replaces duplicate headers', () => {
    http.post('/api/auth/login', {}).subscribe();
    http
      .post(
        '/api/auth/login',
        {},
        {
          headers: new HttpHeaders()
            .append('X-Correlation-ID', 'one')
            .append('X-Correlation-ID', 'two'),
        },
      )
      .subscribe();

    const requests = controller.match('/api/auth/login');

    expect(requests.length).toBe(2);

    const ids = requests.map((r) => r.request.headers.get('X-Correlation-ID'));

    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[1]).toMatch(/^[a-f0-9]{32}$/);

    requests.forEach((r) => r.flush({}));
  });

  it('preserves the ID when authentication refresh retries the original request', () => {
    TestBed.inject(AuthSession).replace({
      accessToken: 'access-first',
      refreshToken: 'refresh-first',
      expiresIn: 60,
    });

    http.get('/api/probe').subscribe();

    const original = controller.expectOne('/api/probe');
    const id = original.request.headers.get('X-Correlation-ID');

    original.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = controller.expectOne('/api/auth/refresh');

    expect(refresh.request.headers.get('X-Correlation-ID')).not.toBe(id);

    refresh.flush({ accessToken: 'access-next', refreshToken: 'refresh-next', expiresIn: 60 });

    const retry = controller.expectOne('/api/probe');

    expect(retry.request.headers.get('X-Correlation-ID')).toBe(id);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-next');

    retry.flush({});
  });

  it('does not attach correlation to unrelated paths or third parties', () => {
    for (const url of ['/api-other/auth/login', 'https://third-party.invalid/api/auth/login']) {
      http.get(url).subscribe();

      const request = controller.expectOne(url);

      expect(request.request.headers.has('X-Correlation-ID')).toBe(false);

      request.flush({});
    }
  });
});
