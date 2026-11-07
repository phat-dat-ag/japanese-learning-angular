import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '../../../../core/auth/auth.interceptor';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { grammarOk } from '../testing/grammar-content.fixture';
import {
  grammarImportItemFixture,
  grammarImportReportFixture,
} from '../testing/lesson-import.fixture';
import { LessonContentImportService } from './lesson-content-import.service';

describe('LessonContentImportService', () => {
  let http: HttpTestingController;
  let service: LessonContentImportService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LessonContentImportService);
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'admin-access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });
  it('reads UTF-8 including Japanese/Vietnamese and rejects invalid encoding', async () => {
    expect(
      await firstValueFrom(
        service.preview(new File([JSON.stringify([grammarImportItemFixture()])], 'grammar.json')),
      ),
    ).toEqual({ status: 'ready', count: 1 });
    expect(
      (await firstValueFrom(service.preview(new File([new Uint8Array([0xc3, 0x28])], 'bad.json'))))
        .status,
    ).toBe('error');
    expect((await firstValueFrom(service.preview(new File([], 'empty.json')))).status).toBe(
      'error',
    );
  });
  it.each(['SKIP_EXISTING', 'UPDATE_EXISTING'] as const)(
    'sends exact original file with mode %s and scoped Bearer',
    (mode) => {
      const file = new File(['[\n  { "title": "日本語" }\n]\n'], 'original.json', {
        type: 'application/json',
      });
      service.importFile(file, mode).subscribe();
      const request = http.expectOne(`/api/v1/lessons/content/import?mode=${mode}`);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Authorization')).toBe('Bearer admin-access');
      expect(request.request.headers.has('Content-Type')).toBe(false);
      const body: FormData = request.request.body;
      expect(Array.from(body.keys())).toEqual(['file']);
      expect(body.get('file')).toBe(file);
      request.flush(grammarOk(grammarImportReportFixture()));
    },
  );
  it('rejects inconsistent reports and does not retry a timed-out import', () => {
    const error = vi.fn();
    const file = new File(['[]'], 'lessons.json');
    service.importFile(file, 'SKIP_EXISTING').subscribe({ error });
    http
      .expectOne('/api/v1/lessons/content/import?mode=SKIP_EXISTING')
      .flush(grammarOk({ ...grammarImportReportFixture(), failed: 0 }));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
    vi.useFakeTimers();
    const timeout = vi.fn();
    service.importFile(file, 'UPDATE_EXISTING').subscribe({ error: timeout });
    const request = http.expectOne('/api/v1/lessons/content/import?mode=UPDATE_EXISTING');
    vi.advanceTimersByTime(15001);
    expect(timeout).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_TIMEOUT' }));
    expect(request.cancelled).toBe(true);
    http.expectNone('/api/v1/lessons/content/import?mode=UPDATE_EXISTING');
  });
});
