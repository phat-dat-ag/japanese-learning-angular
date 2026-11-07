import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { LESSON_ROUTES } from '../lesson.routes';
import { LessonEditor } from './lesson-editor';
import { LessonList } from './lesson-list';

const meta = { timestamp: '2026-11-06', traceId: 'trace', correlationId: 'correlation' };
const lesson = {
  id: 9,
  levelId: 72,
  lessonNumber: 3,
  title: '助詞',
  description: null,
  displayOrder: 20,
};
const levels = [
  { id: 72, code: 'N5', name: 'N5' },
  { id: 81, code: 'N4', name: 'N4' },
];
const ok = (data: unknown) => ({ success: true, data, meta });
describe('Lesson management', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/lessons', children: LESSON_ROUTES }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  it('renders backend order and cancels stale requests on level changes', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons', LessonList);
    const stale = http.expectOne('/api/v1/lessons?level=N5');
    page.changeLevel('N4');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toContain('level=N4'));
    expect(stale.cancelled).toBe(true);
    http
      .expectOne('/api/v1/lessons?level=N4')
      .flush(ok([lesson, { ...lesson, id: 2, lessonNumber: 1, displayOrder: 30 }]));
    harness.detectChanges();
    const rows = harness.routeNativeElement!.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('20');
    expect(rows[1].textContent).toContain('30');
    page.changeLevel('N4');
    http.expectNone('/api/v1/lessons?level=N4');
  });
  it('requires confirmation and retains the row on a deletion conflict', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons', LessonList);
    http.expectOne('/api/v1/lessons?level=N5').flush(ok([lesson]));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.deleteLesson(lesson);
    http.expectNone('/api/v1/lessons/9');
    confirm.mockReturnValue(true);
    page.deleteLesson(lesson);
    page.deleteLesson(lesson);
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('grammar content'));
    http.expectOne('/api/v1/lessons/9').flush(
      {
        success: false,
        error: { code: 'LESSON_CONFLICT', message: 'Referenced', details: [] },
        meta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(page.feedback()).toContain('learning history');
    page.deleteLesson(lesson);
    http.expectOne('/api/v1/lessons/9').flush(ok(lesson));
    http.expectOne('/api/v1/lessons?level=N5').flush(ok([]));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('No lessons');
  });
  it('loads direct edit using persisted IDs/order, validates and prevents duplicate saves', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons/9/edit', LessonEditor);
    http.expectOne('/api/v1/jlpt-levels').flush(ok(levels));
    http.expectOne('/api/v1/lessons/9').flush(ok(lesson));
    harness.detectChanges();
    expect(page.draft.levelId).toBe(72);
    expect(page.draft.displayOrder).toBe(20);
    page.draft.title = ' ';
    page.save();
    expect(page.fields().title).toBeTruthy();
    http.expectNone('/api/v1/lessons/9');
    page.draft.title = 'Updated';
    page.save();
    page.save();
    const save = http.expectOne('/api/v1/lessons/9');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.levelId).toBe(72);
    expect(save.request.body.displayOrder).toBe(20);
    save.flush(
      {
        success: false,
        error: { code: 'LESSON_CONFLICT', message: 'Conflict', details: [] },
        meta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(page.draft.title).toBe('Updated');
    expect(page.message()).toContain('already in use');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(page.canLeave()).toBe(false);
  });
  it('maps create level selection to real IDs and returns to the saved level', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons/new?level=N4', LessonEditor);
    http.expectOne('/api/v1/jlpt-levels').flush(ok(levels));
    expect(page.draft.levelId).toBe(81);
    page.draft = { levelId: 81, lessonNumber: 7, title: 'New', description: '', displayOrder: 90 };
    page.save();
    const request = http.expectOne('/api/v1/lessons');
    expect(request.request.body).toEqual({ ...page.draft, description: null });
    request.flush(ok({ ...lesson, ...request.request.body }));
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/admin/lessons?level=N4'));
    http.expectOne('/api/v1/lessons?level=N4').flush(ok([]));
  });
  it('shows unauthorized load feedback and retries', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons', LessonList);
    http
      .expectOne('/api/v1/lessons?level=N5')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Admin session');
    page.retry();
    http.expectOne('/api/v1/lessons?level=N5').flush(ok([]));
    expect(TestBed.inject(AuthSession).authenticated()).toBe(true);
  });
});
