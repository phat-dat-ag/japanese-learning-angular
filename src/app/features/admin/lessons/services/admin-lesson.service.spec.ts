import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminLessonService } from './admin-lesson.service';

const meta = { timestamp: '2026-11-06', traceId: 'trace', correlationId: 'correlation' };
const lesson = {
  id: 9,
  levelId: 72,
  lessonNumber: 3,
  title: '助詞',
  description: null,
  displayOrder: 20,
};
describe('AdminLessonService', () => {
  let http: HttpTestingController;
  let service: AdminLessonService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdminLessonService);
  });
  afterEach(() => http.verify());
  it('loads actual level IDs and preserves server list order', () => {
    service.getLevels().subscribe((response) => expect(response.data[0].id).toBe(72));
    http
      .expectOne('/api/v1/jlpt-levels')
      .flush({ success: true, data: [{ id: 72, code: 'N5', name: 'N5' }], meta });
    service
      .getLessons('N5')
      .subscribe((response) => expect(response.data.map((item) => item.id)).toEqual([9, 2]));
    http.expectOne('/api/v1/lessons?level=N5').flush({
      success: true,
      data: [lesson, { ...lesson, id: 2, lessonNumber: 1, displayOrder: 30 }],
      meta,
    });
  });
  it('creates and replaces metadata with exact write fields', () => {
    const { id, ...body } = lesson;
    service.createLesson(body).subscribe();
    const create = http.expectOne('/api/v1/lessons');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({ success: true, data: lesson, meta });
    service.updateLesson(id, body).subscribe();
    const update = http.expectOne('/api/v1/lessons/9');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(body);
    update.flush({ success: true, data: lesson, meta });
  });
  it('reads and deletes metadata using validated success bodies', () => {
    service.getLesson(9).subscribe((response) => expect(response.data).toEqual(lesson));
    http.expectOne('/api/v1/lessons/9').flush({ success: true, data: lesson, meta });
    service.deleteLesson(9).subscribe();
    const request = http.expectOne('/api/v1/lessons/9');
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, data: lesson, meta });
  });
  it('rejects legacy metadata and mismatched detail IDs', () => {
    const error = vi.fn();
    service.getLesson(9).subscribe({ error });
    http.expectOne('/api/v1/lessons/9').flush({ success: true, data: { ...lesson, id: 10 }, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });
});
