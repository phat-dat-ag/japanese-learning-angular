import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { LESSON_ROUTES } from '../lesson.routes';
import {
  grammarDocumentFixture,
  grammarEtag,
  grammarLesson,
  grammarMeta,
  grammarOk,
  grammarResponseFixture,
} from '../testing/grammar-content.fixture';
import { LessonContentEditor } from './lesson-content-editor';

describe('Admin grammar content editor', () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function setup(absent = false) {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons/9/content', LessonContentEditor);
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    const request = http.expectOne('/api/v1/lessons/9/content');
    if (absent)
      request.flush(
        {
          success: false,
          error: { code: 'LESSON_CONTENT_NOT_FOUND', message: 'Not found', details: [] },
          meta: grammarMeta,
        },
        { status: 404, statusText: 'Not found' },
      );
    else request.flush(grammarOk(grammarResponseFixture()), { headers: { ETag: grammarEtag } });
    harness.detectChanges();
    return { harness, page };
  }
  it('loads lesson context and exact revision for direct navigation', async () => {
    const { page, harness } = await setup();
    expect(page.state()).toBe('ready');
    expect(page.dirty()).toBe(false);
    expect(page.revision()).toEqual({ version: 2, etag: grammarEtag });
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      grammarLesson.title,
    );
    expect(
      harness.routeNativeElement?.querySelector('a[href="/admin/lessons/9/edit"]'),
    ).not.toBeNull();
    expect(page.validation()).toEqual([]);
  });
  it('adds, edits, moves and removes blocks with stable unique IDs and one draft', async () => {
    const { page } = await setup(true);
    page.addType = 'paragraph';
    page.addBlock();
    const first = page.draft().blocks[0];
    expect(first.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    page.updateBlock({
      ...first,
      type: 'paragraph',
      inlines: [{ text: '日本語 — Tiếng Việt', marks: ['bold'] }],
    });
    page.addType = 'divider';
    page.addBlock();
    const second = page.draft().blocks[1];
    expect(second.id).not.toBe(first.id);
    expect(page.dirty()).toBe(true);
    page.moveBlock(second.id, -1);
    expect(page.draft().blocks.map((block) => block.id)).toEqual([second.id, first.id]);
    page.removeBlock(second.id);
    expect(page.selected()?.id).toBe(first.id);
    expect(page.draft().blocks).toHaveLength(1);
    expect(page.validation()).toEqual([]);
  });
  it('creates empty content at revision zero without If-Match, then saves with refreshed preconditions', async () => {
    const { page } = await setup(true);
    expect(page.revision()).toBeNull();
    expect(page.canSave()).toBe(true);
    page.save();
    page.save();
    const create = http.expectOne('/api/v1/lessons/9/content');
    expect(create.request.body).toEqual({
      schemaVersion: 1,
      expectedVersion: 0,
      content: { blocks: [] },
    });
    expect(create.request.headers.has('If-Match')).toBe(false);
    create.flush(grammarOk(grammarResponseFixture(1, { blocks: [] })), {
      headers: { ETag: '"created:1"' },
    });
    expect(page.dirty()).toBe(false);
    expect(page.success()).toContain('Version 1');
    page.addType = 'divider';
    page.addBlock();
    page.save();
    const update = http.expectOne('/api/v1/lessons/9/content');
    expect(update.request.body.expectedVersion).toBe(1);
    expect(update.request.headers.get('If-Match')).toBe('"created:1"');
    update.flush(grammarOk(grammarResponseFixture(2, page.draft())), {
      headers: { ETag: '"created:2"' },
    });
    expect(page.revision()).toEqual({ version: 2, etag: '"created:2"' });
    expect(page.dirty()).toBe(false);
  });
  it('blocks invalid drafts and resets dirty state only after successful save', async () => {
    const { page } = await setup();
    page.addType = 'example';
    page.addBlock();
    expect(page.canSave()).toBe(false);
    page.save();
    http.expectNone('/api/v1/lessons/9/content');
    const example = page.selected();
    if (!example || example.type !== 'example') throw new Error('Expected example');
    page.updateBlock({
      ...example,
      japanese: '日本語',
      reading: 'にほんご',
      translations: { vi: 'Tiếng Nhật', en: 'Japanese' },
    });
    page.save();
    expect(page.dirty()).toBe(true);
    expect(page.canLeave()).toBe(false);
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk(grammarResponseFixture(3, page.draft())), { headers: { ETag: '"third"' } });
    expect(page.dirty()).toBe(false);
  });
  it('preserves a conflicting draft and requires explicit reload with discard confirmation', async () => {
    const { page } = await setup();
    page.addType = 'divider';
    page.addBlock();
    const draft = page.draft();
    page.save();
    http.expectOne('/api/v1/lessons/9/content').flush(
      {
        success: false,
        error: { code: 'LESSON_CONTENT_CONFLICT', message: 'Conflict', details: [] },
        meta: grammarMeta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(page.draft()).toBe(draft);
    expect(page.requiresReload()).toBe(true);
    expect(page.dirty()).toBe(true);
    page.save();
    page.deleteContent();
    http.expectNone('/api/v1/lessons/9/content');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.reloadServer();
    http.expectNone('/api/v1/lessons/9');
    expect(page.draft()).toBe(draft);
    confirm.mockReturnValue(true);
    page.reloadServer();
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk(grammarResponseFixture(5)), { headers: { ETag: '"server:5"' } });
    expect(page.revision()?.version).toBe(5);
    expect(page.requiresReload()).toBe(false);
    expect(page.dirty()).toBe(false);
  });
  it('preserves drafts and locks unsafe retries when a successful save lacks ETag', async () => {
    const { page } = await setup();
    page.removeBlock('d');
    const draft = page.draft();
    page.save();
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture(3, draft)));
    expect(page.draft()).toBe(draft);
    expect(page.dirty()).toBe(true);
    expect(page.requiresReload()).toBe(true);
    expect(page.message()).toContain('ETag');
    page.save();
    http.expectNone('/api/v1/lessons/9/content');
  });
  it('deletes content only after confirmation and preserves lesson metadata', async () => {
    const { page } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.deleteContent();
    http.expectNone('/api/v1/lessons/9/content?expectedVersion=2');
    confirm.mockReturnValue(true);
    page.deleteContent();
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining('metadata and assignments will be preserved'),
    );
    const request = http.expectOne('/api/v1/lessons/9/content?expectedVersion=2');
    expect(request.request.headers.get('If-Match')).toBe(grammarEtag);
    request.flush(grammarOk(grammarResponseFixture()));
    expect(page.lesson()).toEqual(grammarLesson);
    expect(page.revision()).toBeNull();
    expect(page.draft()).toEqual({ blocks: [] });
    expect(page.dirty()).toBe(false);
    http.expectNone('/api/v1/lessons/9');
  });
  it('warns on dirty navigation and browser unload, and can cancel leaving', async () => {
    const { page, harness } = await setup();
    page.removeBlock('d');
    const event = new Event('beforeunload', { cancelable: true });
    page.beforeUnload(event as BeforeUnloadEvent);
    expect(event.defaultPrevented).toBe(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await harness.navigateByUrl('/admin/lessons/9/edit');
    expect(TestBed.inject(Router).url).toBe('/admin/lessons/9/content');
    expect(confirm).toHaveBeenCalled();
    http.expectNone('/api/v1/jlpt-levels');
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/admin/lessons/9/edit');
    http.expectOne('/api/v1/jlpt-levels').flush(grammarOk([{ id: 72, code: 'N5', name: 'N5' }]));
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
  });
  it.each([403, 500, 0])('keeps drafts on failed writes with status %s', async (status) => {
    const { page } = await setup();
    page.removeBlock('d');
    const draft = page.draft();
    page.save();
    const request = http.expectOne('/api/v1/lessons/9/content');
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush(null, { status, statusText: 'Failure' });
    expect(page.draft()).toBe(draft);
    expect(page.dirty()).toBe(true);
    expect(page.operation()).toBe('idle');
    expect(page.requiresReload()).toBe(status !== 403);
    http.expectNone('/api/v1/lessons/9/content');
  });
  it('distinguishes missing lessons, unsupported schemas and missing ETags on load', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/lessons/9/content', LessonContentEditor);
    http.expectOne('/api/v1/lessons/9').flush(
      {
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found', details: [] },
        meta: grammarMeta,
      },
      { status: 404, statusText: 'Not found' },
    );
    expect(page.state()).toBe('error');
    expect(page.message()).toContain('lesson no longer exists');
    http.expectNone('/api/v1/lessons/9/content');
    page.reloadServer();
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    http
      .expectOne('/api/v1/lessons/9/content')
      .flush(grammarOk({ ...grammarResponseFixture(), schemaVersion: 2 }), {
        headers: { ETag: grammarEtag },
      });
    expect(page.state()).toBe('error');
    expect(page.message()).toContain('unsupported schema');
    page.reloadServer();
    http.expectOne('/api/v1/lessons/9').flush(grammarOk(grammarLesson));
    http.expectOne('/api/v1/lessons/9/content').flush(grammarOk(grammarResponseFixture()));
    expect(page.state()).toBe('error');
    expect(page.message()).toContain('ETag');
  });
  it('exports the preserved local draft as a downloadable JSON file', async () => {
    const { page } = await setup();
    page.removeBlock('d');
    const original = URL;
    const create = vi.fn(() => 'blob:draft');
    const revoke = vi.fn();
    class DownloadURL extends original {
      static override createObjectURL = create;
      static override revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', DownloadURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      page.exportDraft();
      expect(create).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:draft'));
      expect(page.dirty()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('preserves a timed-out draft and requires reloading before another mutation', async () => {
    const { page } = await setup();
    page.removeBlock('d');
    const draft = page.draft();
    vi.useFakeTimers();
    page.save();
    const request = http.expectOne('/api/v1/lessons/9/content');
    vi.advanceTimersByTime(15001);
    expect(request.cancelled).toBe(true);
    expect(page.draft()).toBe(draft);
    expect(page.requiresReload()).toBe(true);
    expect(page.operation()).toBe('idle');
    page.save();
    http.expectNone('/api/v1/lessons/9/content');
  });
  it('rechecks the unsaved guard and reloads context when the route lesson ID changes', async () => {
    const { page, harness } = await setup();
    page.removeBlock('d');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await harness.navigateByUrl('/admin/lessons/10/content');
    expect(TestBed.inject(Router).url).toBe('/admin/lessons/9/content');
    http.expectNone('/api/v1/lessons/10');
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/admin/lessons/10/content');
    http.expectOne('/api/v1/lessons/10').flush(grammarOk({ ...grammarLesson, id: 10 }));
    http
      .expectOne('/api/v1/lessons/10/content')
      .flush(grammarOk({ ...grammarResponseFixture(), lessonId: 10 }), {
        headers: { ETag: '"lesson-10"' },
      });
    expect(page.lesson()?.id).toBe(10);
    expect(page.dirty()).toBe(false);
  });
});
