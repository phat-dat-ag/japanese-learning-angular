import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthSession } from '../../../core/auth/auth-session.service';
import {
  grammarEtag,
  grammarLesson,
  grammarOk,
  grammarResponseFixture,
} from '../../admin/lessons/testing/grammar-content.fixture';
import { LessonReadService } from './lesson-read.service';

describe('Shared lesson reads', () => {
  let http: HttpTestingController;
  let service: LessonReadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LessonReadService);

    const session = TestBed.inject(AuthSession);

    session.replace({ accessToken: 'user-access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'user', username: 'Learner', role: 'User' });
  });

  afterEach(() => http.verify());

  it('reads persisted level IDs and preserves server lesson order including omitted descriptions', () => {
    const { description, ...withoutDescription } = grammarLesson;

    service.getLevels().subscribe((response) => expect(response.data[0].id).toBe(72));
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk([{ id: 72, code: 'N5', name: 'N5' }]));
    service
      .getLessons('N5')
      .subscribe((response) => expect(response.data.map((lesson) => lesson.id)).toEqual([9, 2]));

    const request = http.expectOne('/api/v1/lessons?level=N5');

    expect(request.request.headers.get('Authorization')).toBe('Bearer user-access');

    request.flush(
      grammarOk([
        withoutDescription,
        { ...grammarLesson, id: 2, lessonNumber: 1, displayOrder: 40 },
      ]),
    );
  });

  it('reads metadata and valid content without requiring ETag headers or sending preconditions', () => {
    service.getLesson(9).subscribe((response) => expect(response.data.levelId).toBe(72));
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    service
      .getContent(9)
      .subscribe((response) => expect(response.data.content.blocks).toHaveLength(8));

    const request = http.expectOne('/api/v1/lessons/9/content');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('If-Match')).toBe(false);

    request.flush(grammarOk(grammarResponseFixture()));
  });

  it('rejects wrong identities, malformed content and unsupported schema versions', () => {
    const metadataError = vi.fn();

    service.getLesson(9).subscribe({ error: metadataError });
    http.expectOne('/api/v1/lessons/9').flush(grammarOk({ ...grammarLesson, id: 10 }));
    expect(metadataError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_RESPONSE' }),
    );

    for (const [data, code] of [
      [{ ...grammarResponseFixture(), lessonId: 10 }, 'INVALID_RESPONSE'],
      [{ ...grammarResponseFixture(), schemaVersion: 2 }, 'LESSON_CONTENT_SCHEMA_UNSUPPORTED'],
      [{ ...grammarResponseFixture(), content: { blocks: [null] } }, 'INVALID_RESPONSE'],
    ] as const) {
      const error = vi.fn();
      
      service.getContent(9).subscribe({ error });
      http
        .expectOne('/api/v1/lessons/9/content')
        .flush(grammarOk(data), { headers: { ETag: grammarEtag } });
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ code }));
    }
  });

  it('keeps the session on 403 and uses existing refresh behavior on 401', () => {
    const forbidden = vi.fn();

    service.getLessons('N5').subscribe({ error: forbidden });
    http
      .expectOne('/api/v1/lessons?level=N5')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(forbidden).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(TestBed.inject(AuthSession).authenticated()).toBe(true);

    http.expectNone('/api/auth/refresh');

    const expired = vi.fn();

    service.getContent(9).subscribe({ error: expired });
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(AuthSession).authenticated()).toBe(false);
    expect(expired).toHaveBeenCalled();
  });
});
