import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LessonContentService } from './lesson-content.service';
import {
  grammarDocumentFixture,
  grammarEtag,
  grammarMeta,
  grammarOk,
  grammarResponseFixture,
} from '../testing/grammar-content.fixture';

describe('LessonContentService', () => {
  let service: LessonContentService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LessonContentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reads exact ETag including quotation marks', () => {
    const next = vi.fn();
    service.getContent(9).subscribe(next);
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk(grammarResponseFixture()), { headers: { ETag: grammarEtag } });
    expect(next).toHaveBeenCalledWith({ document: grammarResponseFixture(), etag: grammarEtag });
  });
  it('creates without If-Match and updates with exact revision/ETag', () => {
    const content = grammarDocumentFixture();
    service.saveContent(9, content, null).subscribe();
    const create = http.expectOne('/api/v1/lessons/9/content');
    expect(create.request.method).toBe('PUT');
    expect(create.request.headers.has('If-Match')).toBe(false);
    expect(create.request.body).toEqual({ schemaVersion: 1, expectedVersion: 0, content });
    create.flush(grammarOk(grammarResponseFixture(1)), { headers: { ETag: '"created"' } });
    const next = vi.fn();
    service.saveContent(9, content, { version: 2, etag: grammarEtag }).subscribe(next);
    const update = http.expectOne('/api/v1/lessons/9/content');
    expect(update.request.headers.get('If-Match')).toBe(grammarEtag);
    expect(update.request.body.expectedVersion).toBe(2);
    update.flush(grammarOk(grammarResponseFixture(3)), { headers: { ETag: '"new-exact-etag"' } });
    expect(next.mock.calls[0][0].etag).toBe('"new-exact-etag"');
  });
  it('deletes only content with a version query and exact If-Match, without requiring response ETag', () => {
    service.deleteContent(9, { version: 2, etag: grammarEtag }).subscribe();
    const request = http.expectOne('/api/v1/lessons/9/content?expectedVersion=2');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('If-Match')).toBe(grammarEtag);
    request.flush(grammarOk(grammarResponseFixture()));
  });
  it.each([null, '*', 'W/"weak"', 'unquoted'])(
    'rejects missing/invalid response ETag %s',
    (etag) => {
      const error = vi.fn();
      service.getContent(9).subscribe({ error });
      http
        .expectOne('/api/v1/lessons/9/content')
        .flush(grammarOk(grammarResponseFixture()), etag ? { headers: { ETag: etag } } : {});
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'LESSON_CONTENT_ETAG_MISSING' }),
      );
    },
  );
  it('rejects unsupported schemas, malformed content and wrong lesson identity', () => {
    for (const data of [
      { ...grammarResponseFixture(), schemaVersion: 2 },
      { ...grammarResponseFixture(), content: { blocks: [null] } },
      { ...grammarResponseFixture(), lessonId: 8 },
    ]) {
      const error = vi.fn();
      service.getContent(9).subscribe({ error });
      http
        .expectOne('/api/v1/lessons/9/content')
        .flush(grammarOk(data), { headers: { ETag: grammarEtag } });
      expect(error).toHaveBeenCalled();
    }
  });
  it('preserves conflicts and validation details without retrying writes', () => {
    const error = vi.fn();
    service
      .saveContent(9, grammarDocumentFixture(), { version: 2, etag: grammarEtag })
      .subscribe({ error });
    http.expectOne('/api/v1/lessons/9/content').flush(
      {
        success: false,
        error: { code: 'LESSON_CONTENT_CONFLICT', message: 'Conflict', details: [] },
        meta: grammarMeta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LESSON_CONTENT_CONFLICT', status: 409 }),
    );
    http.expectNone('/api/v1/lessons/9/content');
    expect(() => service.deleteContent(9, { version: 0, etag: '*' })).toThrow();
  });
});
