import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ADMIN_ROUTES } from '../../admin.routes';
import { vocabularyDetailFixture } from '../../vocabulary/testing/vocabulary-detail.fixture';
import { QuizQuestionResponse } from '../models/quiz-question.model';
import { QuestionEditor } from './question-editor';

const path = '/admin/kanji-quiz/questions';
const api = '/api/v1/admin/kanji-quiz/questions';
const meta = { timestamp: '2026-10-11', traceId: 'trace', correlationId: 'correlation' };
const question: QuizQuestionResponse = {
  id: 42,
  version: 7,
  sourceType: 'CUSTOM',
  status: 'DRAFT',
  sentenceReading: '😀がっこうへいく',
  targetStart: 1,
  targetLength: 4,
  targetReading: 'がっこう',
  explanationEn: 'School',
  vocabularyId: 10,
  levelIds: [8],
  lessonIds: [7],
  sourceInvalidated: false,
  eligibleForNewGames: false,
  options: [
    { id: 1, text: '学校', correct: true },
    { id: 2, text: '学生', correct: false },
    { id: 3, text: '先生', correct: false },
    { id: 4, text: '電車', correct: false },
  ],
  createdAt: '2026-10-10',
  updatedAt: '2026-10-11',
};

describe('Question editor', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let editor: QuestionEditor;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin', children: ADMIN_ROUTES }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  async function open(suffix = '/new', query = '') {
    harness = await RouterTestingHarness.create();
    editor = await harness.navigateByUrl(path + suffix + query, QuestionEditor);
    harness.detectChanges();
  }
  function flushDetail(value = question) {
    http.expectOne(api + '/' + value.id).flush({ success: true, data: value, meta });
    harness.detectChanges();
  }
  function form() {
    return editor.formComponent()!;
  }
  function element(): HTMLElement {
    return harness.routeNativeElement!;
  }
  function validCreate() {
    form().form.patchValue({
      sentenceReading: question.sentenceReading,
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
      options: question.options.map((option) => option.text),
      correctIndex: 0,
    });
    form().form.markAsDirty();
    harness.detectChanges();
  }
  function input(id: string, value: string) {
    const control = element().querySelector<HTMLInputElement>('#' + id)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }
  function error(
    status: number,
    code = 'QUIZ_QUESTION_INVALID',
    details: { field: string; message: string }[] = [],
  ) {
    http
      .expectOne((req) => req.method === 'POST' || req.method === 'PUT')
      .flush(
        { success: false, error: { code, message: 'private diagnostics', details }, meta },
        { status, statusText: 'Error' },
      );
    harness.detectChanges();
  }

  it('creates a typed CUSTOM draft exactly once and preserves return query parameters', async () => {
    await open('/new', '?status=DRAFT&page=2&size=50');
    validCreate();
    form().submit();
    form().submit();
    const req = http.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.content).toEqual({
      sourceType: 'CUSTOM',
      sentenceReading: question.sentenceReading,
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
      levelIds: [],
      lessonIds: [],
      vocabularyId: undefined,
      explanationVi: undefined,
      explanationEn: undefined,
    });
    expect(req.request.body.options).toEqual(
      question.options.map(({ text, correct }) => ({ text, correct })),
    );
    expect(editor.canLeave()).toBe(false);
    req.flush({ success: true, data: question, meta });
    harness.detectChanges();
    expect(element().textContent).toContain('Question saved as DRAFT');
    expect(element().querySelector('form')).toBeNull();
    expect(element().querySelector('a[href*="/42/edit"]')?.getAttribute('href')).toContain(
      'status=DRAFT&page=2&size=50',
    );
    expect(editor.canLeave()).toBe(true);
    element().querySelector<HTMLAnchorElement>('a')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(path + '?status=DRAFT&page=2&size=50');
    http
      .expectOne((req) => req.url.startsWith(api))
      .flush({
        success: true,
        data: { items: [], page: 2, size: 50, totalElements: 0, totalPages: 0 },
        meta,
      });
  });

  it('loads a read-only EXAMPLE reading via vocabulary and never submits sentenceReading', async () => {
    await open();
    validCreate();
    form().form.controls.sourceType.setValue('EXAMPLE');
    harness.detectChanges();
    form().lookupId.setValue(10);
    form().loadExamples();
    const data = vocabularyDetailFixture(10);
    http.expectOne('/api/v1/flashcards/10').flush({
      success: true,
      data: {
        ...data,
        examples: [
          {
            exampleId: 3,
            japaneseText: '学校',
            japaneseReading: question.sentenceReading,
            meaningVi: 'Trường',
            meaningEn: 'School',
            targetText: '学校',
            displayOrder: 0,
          },
        ],
      },
      meta,
    });
    harness.detectChanges();
    form().chooseExample('3');
    harness.detectChanges();
    expect(element().querySelector<HTMLTextAreaElement>('#target-preview')?.readOnly).toBe(true);
    expect(element().querySelector('#sentenceReading')).toBeNull();
    form().submit();
    const req = http.expectOne(api);
    expect(req.request.body.content.sourceType).toBe('EXAMPLE');
    expect(req.request.body.content.exampleId).toBe(3);
    expect(req.request.body.content).not.toHaveProperty('sentenceReading');
    req.flush({ success: true, data: { ...question, sourceType: 'EXAMPLE', exampleId: 3 }, meta });
  });

  it('supports manual EXAMPLE references without inventing a lookup endpoint', async () => {
    await open();
    validCreate();
    form().form.patchValue({ sourceType: 'EXAMPLE', exampleId: 8 });
    harness.detectChanges();
    expect(element().textContent).toContain('Source reading is unavailable');
    form().submit();
    const req = http.expectOne(api);
    expect(req.request.body.content.exampleId).toBe(8);
    expect(req.request.body.content).not.toHaveProperty('sentenceReading');
    req.flush({ success: true, data: { ...question, sourceType: 'EXAMPLE', exampleId: 8 }, meta });
  });

  it('selects a target with keyboard-compatible events using code-point indices', async () => {
    await open();
    input('sentenceReading', '😀がっこうへいく');
    const preview = element().querySelector<HTMLTextAreaElement>('#target-preview')!;
    preview.setSelectionRange(2, 6);
    preview.dispatchEvent(new Event('keyup'));
    harness.detectChanges();
    Array.from(element().querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Use selection')!
      .click();
    expect(form().form.getRawValue()).toMatchObject({
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
    });
    expect(form().form.dirty).toBe(true);
    input('sentenceReading', 'かわ');
    expect(
      Array.from(element().querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Use selection',
      )?.disabled,
    ).toBe(true);
  });

  it('shows required errors, binds numeric controls and radio choices, and blocks invalid submissions', async () => {
    await open();
    form().submit();
    harness.detectChanges();
    expect(element().textContent).toContain('Check the highlighted fields');
    expect(element().querySelector('#sentenceReading')?.getAttribute('aria-invalid')).toBe('true');
    http.expectNone(api);
    validCreate();
    input('targetStart', '99');
    form().submit();
    http.expectNone(api);
    input('targetStart', '1');
    const radio = element().querySelectorAll<HTMLInputElement>('input[type="radio"]')[2];
    radio.click();
    expect(form().form.controls.correctIndex.value).toBe(2);
    expect(form().form.controls.targetStart.value).toBe(1);
  });

  it('loads full content, locks source type, and uses the returned version on each edit', async () => {
    await open('/42/edit');
    expect(element().textContent).toContain('Loading question');
    flushDetail({ ...question, status: 'PUBLISHED' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(element().textContent).toContain('returns this published question to DRAFT');
    expect(form().form.controls.sourceType.disabled).toBe(true);
    expect(form().form.getRawValue()).toMatchObject({
      explanationEn: 'School',
      levelIds: '8',
      lessonIds: '7',
    });
    input('explanationEn', 'Updated');
    form().submit();
    const req = http.expectOne(api + '/42');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.version).toBe(7);
    expect(req.request.body).not.toHaveProperty('options');
    req.flush({
      success: true,
      data: { ...question, version: 12, explanationEn: 'Updated' },
      meta,
    });
    harness.detectChanges();
    expect(form().form.pristine).toBe(true);
    input('explanationEn', '');
    form().submit();
    const next = http.expectOne(api + '/42');
    expect(next.request.body.version).toBe(12);
    expect(next.request.body.content.explanationEn).toBeUndefined();
    next.flush({
      success: true,
      data: { ...question, version: 20, explanationEn: undefined },
      meta,
    });
  });

  it('shows archived content read-only and never sends a write', async () => {
    await open('/42/edit');
    flushDetail({ ...question, status: 'ARCHIVED' });
    expect(element().textContent).toContain('Archived questions are read-only');
    expect(element().querySelector<HTMLFieldSetElement>('form fieldset')?.disabled).toBe(true);
    form().submit();
    http.expectNone((req) => req.method !== 'GET');
  });

  it('repairs an EXAMPLE source reference while preserving its type and omitting the owned sentence', async () => {
    await open('/42/edit');
    flushDetail({
      ...question,
      sourceType: 'EXAMPLE',
      exampleId: 3,
      sentenceReading: undefined,
      sourceInvalidated: true,
    });
    input('exampleId', '9');
    form().submit();
    const req = http.expectOne(api + '/42');
    expect(req.request.body.content).toMatchObject({ sourceType: 'EXAMPLE', exampleId: 9 });
    expect(req.request.body.content).not.toHaveProperty('sentenceReading');
    req.flush({ success: true, data: { ...question, sourceType: 'EXAMPLE', exampleId: 9 }, meta });
  });

  it('maps backend field paths safely while retaining entered values', async () => {
    await open();
    validCreate();
    form().submit();
    error(400, 'BAD_REQUEST', [
      { field: 'create.request.content.targetReading', message: 'private diagnostics' },
      { field: 'options[0].text', message: 'private diagnostics' },
    ]);
    expect(element().textContent).not.toContain('private diagnostics');
    expect(element().querySelector('#targetReading-error')?.textContent).toContain(
      'server rejected',
    );
    expect(element().querySelector('#options-error')?.textContent).toContain('server rejected');
    expect(form().form.controls.sentenceReading.value).toBe(question.sentenceReading);
  });

  it('surfaces existing-option validation failures alongside the option panel', async () => {
    await open('/42/edit');
    flushDetail();
    form().submit();
    error(400, 'QUIZ_QUESTION_INVALID', [{ field: 'options', message: 'private diagnostics' }]);
    expect(element().querySelector('#options-error')?.textContent).toContain('server rejected');
    expect(element().querySelector('#option-0')).toBeNull();
  });
  it('retains conflicting edits, blocks blind resubmission, and reloads only after confirmation', async () => {
    await open('/42/edit');
    flushDetail();
    input('explanationEn', 'Mine');
    form().submit();
    error(409, 'QUIZ_QUESTION_CONFLICT');
    expect(form().form.controls.explanationEn.value).toBe('Mine');
    form().submit();
    http.expectNone(api + '/42');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    editor.reloadQuestion();
    http.expectNone(api + '/42');
    confirm.mockReturnValue(true);
    editor.reloadQuestion();
    flushDetail({ ...question, version: 99, explanationEn: 'Theirs' });
    expect(form().form.controls.explanationEn.value).toBe('Theirs');
    expect(form().form.pristine).toBe(true);
    form().submit();
    const req = http.expectOne(api + '/42');
    expect(req.request.body.version).toBe(99);
    req.flush({ success: true, data: { ...question, version: 100 }, meta });
  });

  it.each([401, 403, 404, 500])(
    'retains form data after HTTP %s without automatic retries',
    async (status) => {
      await open();
      validCreate();
      form().submit();
      error(status);
      expect(element().querySelector('[role="alert"]')).not.toBeNull();
      expect(form().form.controls.targetReading.value).toBe('がっこう');
      expect(element().textContent).not.toContain('private diagnostics');
      http.expectNone(api);
    },
  );

  it('handles invalid IDs, load failures, and retry', async () => {
    await open('/invalid/edit');
    expect(element().textContent).toContain('Invalid question ID');
    http.expectNone((req) => true);
    await harness.navigateByUrl(path + '/42/edit', QuestionEditor);
    http.expectOne(api + '/42').flush({}, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(element().textContent).toContain('Unable to load');
    editor.reloadQuestion();
    flushDetail();
  });

  it('cancels stale detail and example requests', async () => {
    await open('/42/edit');
    const stale = http.expectOne(api + '/42');
    await harness.navigateByUrl(path + '/43/edit', QuestionEditor);
    expect(stale.cancelled).toBe(true);
    flushDetail({ ...question, id: 43 });
    editor.lookup(10);
    const examples = http.expectOne('/api/v1/flashcards/10');
    editor.lookup(null);
    expect(examples.cancelled).toBe(true);
  });

  it('keeps a duplicate-create conflict editable and does not retry automatically', async () => {
    await open();
    validCreate();
    form().submit();
    error(409, 'QUIZ_QUESTION_CONFLICT');
    expect(editor.locked()).toBe(false);
    expect(form().form.dirty).toBe(true);
    expect(element().textContent).toContain('may already exist');
    http.expectNone(api);
  });

  it('protects unsaved changes when the reused edit route changes question ID', async () => {
    await open('/42/edit');
    flushDetail();
    input('explanationEn', 'Mine');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await harness.navigateByUrl(path + '/43/edit');
    expect(TestBed.inject(Router).url).toBe(path + '/42/edit');
    http.expectNone(api + '/43');
    confirm.mockReturnValue(true);
    await harness.navigateByUrl(path + '/43/edit');
    flushDetail({ ...question, id: 43 });
    expect(form().form.controls.explanationEn.value).toBe('School');
  });

  it('handles lookup failures and empty results with a working retry', async () => {
    await open();
    form().form.controls.sourceType.setValue('EXAMPLE');
    harness.detectChanges();
    form().lookupId.setValue(10);
    form().loadExamples();
    http.expectOne('/api/v1/flashcards/10').flush({}, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(element().textContent).toContain('Unable to load examples');
    form().loadExamples();
    http
      .expectOne('/api/v1/flashcards/10')
      .flush({ success: true, data: vocabularyDetailFixture(10), meta });
    harness.detectChanges();
    expect(element().textContent).toContain('This vocabulary has no examples');
  });
  it('guards dirty navigation and browser unload, then permits confirmed navigation', async () => {
    await open();
    input('sentenceReading', 'かな');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await harness.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe(path + '/new');
    expect(confirm).toHaveBeenCalled();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe('/admin');
  });
  it('displays all options and saves validated text with the current version', async () => {
    await open('/42/edit');
    flushDetail();
    const panel = editor.optionsComponent()!;
    for (const option of question.options) expect(element().textContent).toContain(option.text);
    panel.edit(2);
    panel.text.setValue(question.options[0].text);
    panel.saveText();
    expect(panel.errors().options).toContain('duplicates');
    http.expectNone((req) => req.method === 'PUT');
    panel.text.setValue('New option');
    panel.saveText();
    panel.saveText();
    editor.lifecycle('archive');
    const req = http.expectOne(api + '/42/options/2');
    expect(req.request.body).toEqual({ version: 7, text: 'New option' });
    expect(editor.canLeave()).toBe(false);
    req.flush({
      success: true,
      data: {
        ...question,
        version: 15,
        options: question.options.map((option) =>
          option.id === 2 ? { ...option, text: 'New option' } : option,
        ),
      },
      meta,
    });
    harness.detectChanges();
    expect(panel.dirty()).toBe(false);
    expect(element().textContent).toContain('New option');
    panel.edit(2);
    panel.text.setValue('Next option');
    panel.saveText();
    const next = http.expectOne(api + '/42/options/2');
    expect(next.request.body.version).toBe(15);
    next.flush({ success: true, data: question, meta });
  });

  it('selects exactly one correct answer and preserves selection after failure', async () => {
    await open('/42/edit');
    flushDetail();
    const panel = editor.optionsComponent()!;
    const radios = element().querySelectorAll<HTMLInputElement>('input[name="savedCorrectOption"]');
    radios[2].click();
    harness.detectChanges();
    expect(Array.from(radios).filter((radio) => radio.checked)).toHaveLength(1);
    expect(panel.correctId.value).toBe(3);
    panel.saveCorrect();
    const req = http.expectOne(api + '/42/correct-option');
    expect(req.request.body).toEqual({ version: 7, optionId: 3 });
    req.flush({}, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(panel.correctId.value).toBe(3);
    expect(panel.dirty()).toBe(true);
    panel.saveCorrect();
    http.expectOne(api + '/42/correct-option').flush({
      success: true,
      data: {
        ...question,
        version: 8,
        options: question.options.map((option) => ({ ...option, correct: option.id === 3 })),
      },
      meta,
    });
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(panel.dirty()).toBe(false);
    const publish = Array.from(element().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Publish question',
    );
    expect(publish?.disabled).toBe(false);
    expect(Array.from(radios).filter((radio) => radio.checked)).toHaveLength(1);
  });

  it.each(['publish', 'unpublish', 'archive'] as const)(
    'confirms %s and refreshes status from the response',
    async (action) => {
      await open('/42/edit', '?keyword=school&status=DRAFT&page=3&size=20');
      flushDetail({ ...question, status: action === 'unpublish' ? 'PUBLISHED' : 'DRAFT' });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      editor.lifecycle(action);
      http.expectNone((req) => req.method === 'POST');
      confirm.mockReturnValue(true);
      editor.lifecycle(action);
      editor.lifecycle(action);
      form().submit();
      const req = http.expectOne(api + '/42/' + action);
      expect(req.request.body).toEqual({ version: 7 });
      const status =
        action === 'publish' ? 'PUBLISHED' : action === 'archive' ? 'ARCHIVED' : 'DRAFT';
      req.flush({
        success: true,
        data: { ...question, version: 9, status, eligibleForNewGames: action === 'publish' },
        meta,
      });
      harness.detectChanges();
      expect(element().textContent).toContain(status);
      expect(element().querySelector('a')?.getAttribute('href')).toContain(
        'keyword=school&status=DRAFT&page=3&size=20',
      );
      expect(editor.optionsComponent()!.question().version).toBe(9);
    },
  );

  it.each([
    { status: 'PUBLISHED', action: 'publish', label: 'Revalidate question', result: 'PUBLISHED' },
    { status: 'ARCHIVED', action: 'unpublish', label: 'Restore to draft', result: 'DRAFT' },
  ] as const)(
    'supports the documented $status -> $action transition',
    async ({ status, action, label, result }) => {
      await open('/42/edit');
      flushDetail({ ...question, status, sourceInvalidated: true });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const button = Array.from(element().querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === label,
      );
      expect(button).toBeDefined();
      button!.click();
      http.expectNone(api + '/42/' + action);
      confirm.mockReturnValue(true);
      button!.click();
      editor.lifecycle(action);
      const request = http.expectOne(api + '/42/' + action);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ version: question.version });
      request.flush({
        success: true,
        data: {
          ...question,
          status: result,
          version: 19,
          sourceInvalidated: false,
          eligibleForNewGames: result === 'PUBLISHED',
        },
        meta,
      });
      harness.detectChanges();
      expect(editor.optionsComponent()!.question().version).toBe(19);
      expect(element().textContent).toContain(result);
      expect(editor.locked()).toBe(false);
    },
  );

  it.each([undefined, null])(
    'loads EXAMPLE choices with optional vocabulary metadata %s',
    async (missing) => {
      await open();
      form().form.controls.sourceType.setValue('EXAMPLE');
      form().lookupId.setValue(10);
      form().loadExamples();
      // openapi.yaml: FlashcardLevelResponse, FlashcardLessonResponse, FlashcardKanjiResponse.
      http.expectOne('/api/v1/flashcards/10').flush({
        success: true,
        data: {
          ...vocabularyDetailFixture(10),
          levels: [{ levelId: 5, code: 'N5', name: 'Beginner', displayOrder: missing }],
          lessons: [
            {
              lessonId: 7,
              levelCode: 'N5',
              levelName: 'Beginner',
              lessonNumber: 2,
              title: 'Lesson',
              description: missing,
              displayOrder: 0,
              assignmentDisplayOrder: 0,
            },
          ],
          kanji: [
            {
              kanjiId: 8,
              character: 'A',
              strokeCount: missing,
              meaningVi: missing,
              meaningEn: missing,
              displayOrder: 0,
              readings: [],
            },
          ],
          examples: [
            {
              exampleId: 3,
              japaneseText: 'School',
              japaneseReading: '????',
              meaningVi: 'School',
              meaningEn: 'School',
              targetText: 'School',
              displayOrder: 0,
            },
          ],
        },
        meta,
      });
      harness.detectChanges();
      expect(element().textContent).not.toContain('Unable to load examples');
      form().chooseExample('3');
      harness.detectChanges();
      expect(form().form.controls.exampleId.value).toBe(3);
      expect(form().exampleReading()).toBe('????');
    },
  );

  it('blocks invalid lifecycle transitions, unsaved changes, and archived writes', async () => {
    await open('/42/edit');
    flushDetail();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    editor.lifecycle('unpublish');
    editor.optionsComponent()!.edit(1);
    editor.lifecycle('publish');
    expect(confirm).not.toHaveBeenCalled();
    editor.optionsComponent()!.cancel();
    input('explanationEn', 'Unsaved');
    editor.lifecycle('archive');
    expect(confirm).not.toHaveBeenCalled();
    editor.reloadQuestion();
    flushDetail({ ...question, status: 'ARCHIVED' });
    editor.lifecycle('publish');
    editor.lifecycle('archive');
    editor.updateOption({ optionId: 1, text: 'Changed' });
    editor.changeCorrectOption(2);
    editor.optionsComponent()!.edit(1);
    expect(editor.optionsComponent()!.editingId()).toBeNull();
    http.expectNone((req) => req.method !== 'GET');
  });

  it('shows publication validation failures without leaking backend diagnostics', async () => {
    await open('/42/edit');
    flushDetail();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    editor.lifecycle('publish');
    error(400, 'QUIZ_QUESTION_INVALID', [{ field: 'options', message: 'private diagnostics' }]);
    expect(element().textContent).toContain('four distinct answer options');
    expect(element().textContent).not.toContain('private diagnostics');
    expect(editor.locked()).toBe(false);
  });

  it('retains option edits on conflict and requires reload before any new mutation', async () => {
    await open('/42/edit');
    flushDetail();
    const panel = editor.optionsComponent()!;
    panel.edit(2);
    panel.text.setValue('Mine');
    panel.saveText();
    error(409);
    expect(panel.text.value).toBe('Mine');
    expect(editor.locked()).toBe(true);
    panel.saveText();
    editor.lifecycle('publish');
    http.expectNone((req) => req.method !== 'GET');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    editor.reloadQuestion();
    http.expectNone(api + '/42');
    confirm.mockReturnValue(true);
    editor.reloadQuestion();
    flushDetail({ ...question, version: 30 });
    expect(editor.optionsComponent()!.dirty()).toBe(false);
    expect(editor.locked()).toBe(false);
  });

  it('confirms availability changes when editing published options', async () => {
    await open('/42/edit');
    flushDetail({ ...question, status: 'PUBLISHED' });
    const panel = editor.optionsComponent()!;
    panel.edit(2);
    panel.text.setValue('Changed');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    panel.saveText();
    http.expectNone((req) => req.method === 'PUT');
    confirm.mockReturnValue(true);
    panel.saveText();
    http.expectOne(api + '/42/options/2').flush({ success: true, data: question, meta });
    harness.detectChanges();
    expect(editor.optionsComponent()!.question().status).toBe('DRAFT');
  });
  it.each([401, 403, 404, 409, 500])(
    'handles lifecycle HTTP %s without retrying or changing status',
    async (status) => {
      await open('/42/edit');
      flushDetail();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      editor.lifecycle('publish');
      error(status);
      expect(editor.optionsComponent()!.question().status).toBe('DRAFT');
      expect(element().querySelector('[role="alert"]')).not.toBeNull();
      expect(editor.locked()).toBe(status === 409);
      http.expectNone((req) => req.method === 'POST');
    },
  );

  it('guards navigation and browser unload for unsaved option changes', async () => {
    await open('/42/edit');
    flushDetail();
    editor.optionsComponent()!.edit(1);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await harness.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe(path + '/42/edit');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toBe('/admin');
  });
  it.each([0, 2, 4])(
    'blocks publishing and text updates with %s correct options while allowing selection repair',
    async (count) => {
      await open('/42/edit');
      flushDetail({
        ...question,
        options: question.options.map((option, index) => ({ ...option, correct: index < count })),
      });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      editor.lifecycle('publish');
      harness.detectChanges();
      expect(element().textContent).toContain('Choose exactly one correct answer');
      expect(confirm).not.toHaveBeenCalled();
      const panel = editor.optionsComponent()!;
      panel.edit(2);
      panel.text.setValue('Changed');
      panel.saveText();
      editor.updateOption({ optionId: 2, text: 'Changed' });
      http.expectNone((req) => req.method !== 'GET');
      panel.cancel();
      panel.correctId.setValue(1);
      panel.saveCorrect();
      const req = http.expectOne(api + '/42/correct-option');
      expect(req.request.body).toEqual({ version: 7, optionId: 1 });
      req.flush({ success: true, data: question, meta });
    },
  );

  it.each(['blank', 'duplicate', 'missing'] as const)(
    'blocks publishing with a %s option',
    async (kind) => {
      await open('/42/edit');
      const options =
        kind === 'missing'
          ? question.options.slice(0, 3)
          : question.options.map((option, index) =>
            index === 0
              ? { ...option, text: kind === 'blank' ? '   ' : question.options[1].text }
              : option,
          );
      flushDetail({ ...question, options });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      editor.lifecycle('publish');
      harness.detectChanges();
      expect(element().textContent).toContain('Provide four nonblank options');
      http.expectNone((req) => req.method === 'POST');
    },
  );
});
