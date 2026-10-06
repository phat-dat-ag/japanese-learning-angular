import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { FileImport } from './file-import';
import { FileImportService, LESSON_FILE_LIMIT, validateImportFile } from './file-import.service';
import { isLessonBatchResponse, isVocabularyImportResult } from './import.models';

const meta = { timestamp: '2026-10-05', traceId: 'trace', correlationId: 'correlation' };
const vocabularyResult = { total: 3, created: 2, updated: 1 };
const lessonSuccess = {
  index: 0,
  success: true,
  lesson: { id: 12, lessonNumber: 1, title: 'First lesson' },
};
const lessonFailure = {
  index: 1,
  success: false,
  error: {
    code: 'LESSON_CONFLICT',
    message: 'Lesson number already exists.',
    details: [{ field: 'lessonNumber', message: 'Must be unique within the level.' }],
  },
};
const partialResult = {
  total: 2,
  succeeded: 1,
  failed: 1,
  results: [lessonSuccess, lessonFailure],
};

describe.each([
  { kind: 'vocabulary', endpoint: '/api/vocabularies/import', result: vocabularyResult },
  {
    kind: 'lessons',
    endpoint: '/api/v1/lessons/batch',
    result: { total: 1, succeeded: 1, failed: 0, results: [lessonSuccess] },
  },
])('$kind file import', ({ kind, endpoint, result }) => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { importKind: kind } } } },
      ],
    });

    const session = TestBed.inject(AuthSession);

    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup() {
    const fixture = TestBed.createComponent(FileImport);

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const fileInput = element.querySelector('input');
    const form = element.querySelector('form');

    if (!fileInput || !form) throw new Error('Missing import form');

    const select = (file = new File(['[{}]'], 'import.data', { type: 'text/plain' })) => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: { item: () => file },
      });

      fileInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      return file;
    };

    const submit = () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };

    return { fixture, element, fileInput, select, submit };
  }

  it('uploads the selected file with auth, prevents duplicate submits, and displays the result', () => {
    const page = setup();
    const file = page.select();

    expect(page.element.textContent).toContain('import.data');
    expect(page.element.textContent).toContain('4 bytes');

    page.submit();
    page.submit();

    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('file')).toMatchObject({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    expect(page.fileInput.disabled).toBe(true);
    expect(page.element.querySelector('button')?.disabled).toBe(true);
    expect(page.element.textContent).toContain('Importing');
    request.flush({ success: true, data: result, meta });
    page.fixture.detectChanges();
    expect(page.fixture.componentInstance.file()).toBeNull();
    expect(page.element.textContent).toContain(
      kind === 'vocabulary' ? 'Created: 2' : 'Succeeded: 1',
    );
    expect(page.element.textContent).toContain(kind === 'vocabulary' ? 'Updated: 1' : 'Failed: 0');
    expect(page.element.textContent).toContain('correlation');
    expect(page.fileInput.disabled).toBe(false);
    expect(page.element.querySelector('button')?.disabled).toBe(true);
  });

  it('requires a non-empty file without rejecting files based on extension or MIME', () => {
    const page = setup();

    page.submit();
    expect(page.element.textContent).toContain('Choose a JSON file');
    page.select(new File([], 'empty.json'));
    page.submit();
    expect(page.element.textContent).toContain('empty');
    TestBed.inject(HttpTestingController).expectNone(endpoint);
    expect(
      validateImportFile(
        new File(['[]'], 'file.bin', { type: 'application/octet-stream' }),
        kind === 'lessons' ? 'lessons' : 'vocabulary',
      ),
    ).toBeNull();
  });

  it('preserves the file and validation details after failure, then allows a retry', () => {
    const page = setup();
    const file = page.select();

    page.submit();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Check the import data.',
            details: [{ field: 'items[0].title', message: 'Title is required.' }],
          },
          meta,
        },
        { status: 400, statusText: 'Bad request' },
      );

    page.fixture.detectChanges();

    expect(page.fixture.componentInstance.file()).toBe(file);
    expect(page.element.textContent).toContain('Title is required');
    expect(page.element.textContent).toContain('items[0].title');
    expect(page.element.querySelector('button')?.disabled).toBe(false);

    if (kind === 'vocabulary')
      expect(page.element.textContent).toContain('No vocabulary changes were saved');

    page.submit();

    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({ success: true, data: result, meta });

    page.fixture.detectChanges();
    expect(page.element.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    [403, 'Admin account is required'],
    [413, 'limit'],
    [415, 'upload format'],
    [500, 'could not be confirmed'],
  ])('shows safe feedback and retains the file on HTTP %s', (status, message) => {
    const page = setup();
    const file = page.select();

    page.submit();

    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush(
        {
          success: false,
          error: { code: 'ERROR', message: 'Internal diagnostic must not appear', details: [] },
          meta,
        },
        { status: Number(status), statusText: 'Error' },
      );

    page.fixture.detectChanges();

    expect(page.element.textContent).toContain(message);
    expect(page.element.textContent).not.toContain('Internal diagnostic');
    expect(page.fixture.componentInstance.file()).toBe(file);

    if (status === 500 && kind === 'lessons')
      expect(page.element.textContent).toContain('Some lessons may already have been created');
  });

  it('uses existing refresh behavior on 401 and retains a retryable file if refresh fails', () => {
    const page = setup();
    const file = page.select();

    page.submit();

    const http = TestBed.inject(HttpTestingController);

    http.expectOne(endpoint).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    page.fixture.detectChanges();

    expect(page.element.textContent).toContain('Please sign in again');
    expect(page.fixture.componentInstance.file()).toBe(file);
    expect(page.element.querySelector('button')?.disabled).toBe(true);
  });

  it('blocks submission if the role changes after opening the page', () => {
    const page = setup();

    page.select();
    TestBed.inject(AuthSession).setUser({ userId: 'user', username: 'User', role: 'User' });
    page.submit();
    expect(page.element.textContent).toContain('An Admin session is required');
    TestBed.inject(HttpTestingController).expectNone(endpoint);
  });

  it('treats malformed success responses as unconfirmed imports', () => {
    const page = setup();

    page.select();
    page.submit();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({ success: true, data: {}, meta });
    page.fixture.detectChanges();
    expect(page.element.textContent).toContain('could not be confirmed');
    expect(page.fixture.componentInstance.file()).not.toBeNull();
  });

  if (kind === 'lessons') {
    it('enforces the lesson byte limit before upload', () => {
      const page = setup();

      page.select(new File([new Uint8Array(LESSON_FILE_LIMIT + 1)], 'large.json'));
      page.submit();
      expect(page.element.textContent).toContain('at most 1 MiB');
      TestBed.inject(HttpTestingController).expectNone(endpoint);
    });

    it('shows partial success, per-item conflicts, and keeps results while selecting a corrected file', () => {
      const page = setup();

      page.select();
      page.submit();
      TestBed.inject(HttpTestingController)
        .expectOne(endpoint)
        .flush({ success: true, data: partialResult, meta });
      page.fixture.detectChanges();
      expect(page.element.textContent).toContain('Total: 2');
      expect(page.element.textContent).toContain('Succeeded: 1');
      expect(page.element.textContent).toContain('Failed: 1');
      expect(page.element.textContent).toContain('Item 2: LESSON_CONFLICT');
      expect(page.element.textContent).toContain('Must be unique within the level');
      expect(page.element.textContent).toContain('only those items');
      page.select();
      expect(page.element.textContent).toContain('LESSON_CONFLICT');
      page.submit();
      TestBed.inject(HttpTestingController)
        .expectOne(endpoint)
        .flush(null, { status: 500, statusText: 'Error' });
      page.fixture.detectChanges();
      expect(page.element.textContent).toContain('LESSON_CONFLICT');
    });

    it('does not describe an all-failed HTTP 200 batch as successful', () => {
      const page = setup();

      page.select();
      page.submit();

      TestBed.inject(HttpTestingController)
        .expectOne(endpoint)
        .flush({
          success: true,
          data: { total: 1, succeeded: 0, failed: 1, results: [{ ...lessonFailure, index: 0 }] },
          meta,
        });
      page.fixture.detectChanges();
      expect(page.element.textContent).toContain('No lessons created');
      expect(page.element.textContent).toContain('Succeeded: 0');
    });
  }
});

describe('Import contract validation', () => {
  it('does not apply the lesson byte limit to vocabulary', () => {
    const file = new File([new Uint8Array(LESSON_FILE_LIMIT + 1)], 'vocabulary.json');

    expect(validateImportFile(file, 'vocabulary')).toBeNull();
    expect(
      validateImportFile(new File([new Uint8Array(LESSON_FILE_LIMIT)], 'lessons.json'), 'lessons'),
    ).toBeNull();
  });

  it('rejects inconsistent counts, invalid indices and malformed item errors', () => {
    expect(isVocabularyImportResult(vocabularyResult)).toBe(true);
    expect(isVocabularyImportResult({ total: 3, created: 3, updated: 1 })).toBe(false);
    expect(isLessonBatchResponse(partialResult)).toBe(true);
    expect(isLessonBatchResponse({ ...partialResult, succeeded: 2 })).toBe(false);
    expect(
      isLessonBatchResponse({
        ...partialResult,
        results: [lessonSuccess, { ...lessonFailure, index: 0 }],
      }),
    ).toBe(false);
    expect(
      isLessonBatchResponse({
        ...partialResult,
        results: [lessonSuccess, { ...lessonFailure, error: { code: 'ERROR' } }],
      }),
    ).toBe(false);
  });

  it('preserves response metadata at the service boundary', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const next = vi.fn();

    TestBed.inject(FileImportService)
      .importLessons(new File(['[{}]'], 'lessons.json'))
      .subscribe(next);

    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/v1/lessons/batch').flush({ success: true, data: partialResult, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: partialResult, meta });
    http.verify();
  });
});
