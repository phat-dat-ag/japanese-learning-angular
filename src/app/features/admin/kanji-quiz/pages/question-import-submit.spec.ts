import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { QuestionImport } from './question-import';
import { quizImportFixture } from '../testing/question-import.fixture';
import { importMeta as meta, importResultFixture } from '../testing/quiz-import-result.fixture';

const url = '/api/v1/admin/kanji-quiz/questions/import';

describe('Quiz import submission and results', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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
  async function setup(count = 2) {
    const fixture = TestBed.createComponent(QuestionImport);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const select = (file: File) => {
      Object.defineProperty(input, 'files', { configurable: true, value: { item: () => file } });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const file = new File(
      [JSON.stringify(Array.from({ length: count }, () => quizImportFixture()))],
      'questions.json',
      { type: 'application/json' },
    );
    select(file);
    expect(page.canSubmit()).toBe(false);
    await vi.waitFor(() => expect(page.state().status).toBe('ready'));
    fixture.detectChanges();
    return { page, fixture, element, input, select, file };
  }
  it('prevents duplicate submissions, replacement, clearing, and navigation while importing', async () => {
    const { page, fixture, element, input, select, file } = await setup();
    expect(page.canSubmit()).toBe(true);
    page.submit();
    page.submit();
    page.clear();
    page.retry();
    select(new File(['[]'], 'other.json'));
    fixture.detectChanges();
    expect(page.file()).toBe(file);
    expect(input.disabled).toBe(true);
    expect(page.canLeave()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(element.textContent).toContain('Uploading and importing');
    const request = http.expectOne(url);
    expect(request.request.body.get('file')).toBe(file);
    request.flush({ success: true, data: importResultFixture(['IMPORTED', 'IMPORTED']), meta });
    fixture.detectChanges();
    expect(page.canLeave()).toBe(true);
    expect(input.disabled).toBe(false);
    expect(element.textContent).toContain('All questions were imported as DRAFT');
    expect(element.textContent).toContain('Total: 2 / Imported: 2 / Failed: 0');
    expect(element.textContent).toContain('Created question #101, version 1');
  });
  it('shows partial success at original indices, even if results arrive in a different order', async () => {
    const { page, fixture, element } = await setup();
    page.submit();
    const result = importResultFixture(['FAILED', 'IMPORTED']);
    http
      .expectOne(url)
      .flush({ success: true, data: { ...result, results: [...result.results].reverse() }, meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Partial success');
    expect(element.textContent).toContain('Total: 2 / Imported: 1 / Failed: 1');
    const entries = element.querySelectorAll('article');
    expect(entries[0].textContent).toContain('Backend result [0]: FAILED');
    expect(entries[0].textContent).toContain('[0].content.exampleId (QUIZ_REFERENCE_NOT_FOUND)');
    expect(entries[1].textContent).toContain('Created question #101, version 1');
    expect(entries[1].querySelector('a')?.getAttribute('href')).toBe(
      '/admin/kanji-quiz/questions/101/edit',
    );
    http.expectNone(url);
  });
  it('treats all-item failure as a completed batch, not a failed HTTP request', async () => {
    const { page, fixture, element } = await setup();
    page.submit();
    http
      .expectOne(url)
      .flush({ success: true, data: importResultFixture(['FAILED', 'FAILED']), meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Total: 2 / Imported: 0 / Failed: 2');
    expect(element.textContent).toContain('no questions were imported');
    expect(element.textContent).not.toContain('Import request failed');
    expect(page.questions()).toHaveLength(2);
    http.expectNone(url);
  });
  it.each([400, 401, 403, 413, 500, 503])(
    'keeps preview and file after request error %s, with no automatic retry',
    async (status) => {
      const { page, fixture, element, file } = await setup();
      page.submit();
      http.expectOne(url).flush(
        {
          success: false,
          error: {
            code: 'QUIZ_IMPORT_INVALID',
            message: 'private diagnostics',
            details: [{ field: 'file', message: 'Too many questions' }],
          },
          meta,
        },
        { status, statusText: 'Error' },
      );
      fixture.detectChanges();
      expect(element.textContent).toContain('Import request failed');
      expect(element.textContent).not.toContain('private diagnostics');
      if (status === 400) expect(element.textContent).toContain('Too many questions');
      if (status >= 500)
        expect(element.textContent).toContain('Some questions may already have been imported');
      expect(page.file()).toBe(file);
      expect(page.questions()).toHaveLength(2);
      expect(page.outcome()).toBeNull();
      http.expectNone(url);
    },
  );
  it('handles lost network responses as uncertain outcomes and requires confirmation to retry', async () => {
    const { page, fixture, element } = await setup();
    page.submit();
    http.expectOne(url).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(element.textContent).toContain('Some questions may already have been imported');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.submit();
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Previously successful questions may be re-imported'),
    );
    http.expectNone(url);
  });
  it('confirms whole-file retries and retains earlier results when a retry fails', async () => {
    const { page, fixture, element, file } = await setup();
    page.submit();
    const data = importResultFixture(['IMPORTED', 'FAILED']);
    http.expectOne(url).flush({ success: true, data, meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Retrying the entire file may re-import');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.submit();
    http.expectNone(url);
    confirm.mockReturnValue(true);
    page.submit();
    expect(page.outcome()?.data).toEqual(data);
    const request = http.expectOne(url);
    expect(request.request.body.get('file')).toBe(file);
    request.flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(page.outcome()?.data).toEqual(data);
    expect(element.textContent).toContain('Last completed import results');
    expect(element.textContent).toContain('Import request failed');
  });
  it('does not submit invalid files or after Admin access is lost', async () => {
    const { page, select } = await setup();
    TestBed.inject(AuthSession).setUser({ userId: 'user', username: 'User', role: 'User' });
    expect(page.canSubmit()).toBe(false);
    page.submit();
    http.expectNone(url);
    TestBed.inject(AuthSession).setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
    select(new File(['[null]'], 'invalid.json'));
    await vi.waitFor(() => expect(page.state().status).toBe('ready'));
    expect(page.canSubmit()).toBe(false);
    page.submit();
    http.expectNone(url);
    select(new File(['x'.repeat(1048577)], 'large.json'));
    expect(page.canSubmit()).toBe(false);
    page.submit();
    http.expectNone(url);
    page.clear();
    page.submit();
    http.expectNone(url);
  });
  it('rejects a batch result count that does not match the selected array', async () => {
    const { page, fixture, element } = await setup();
    page.submit();
    http.expectOne(url).flush({ success: true, data: importResultFixture(), meta });
    fixture.detectChanges();
    expect(page.outcome()).toBeNull();
    expect(element.textContent).toContain('outcome could not be confirmed');
  });
  it('keeps result indices aligned across preview pages and clears results for a new file', async () => {
    const { page, fixture, element, select } = await setup(21);
    page.submit();
    http.expectOne(url).flush({
      success: true,
      data: importResultFixture(Array.from({ length: 21 }, () => 'IMPORTED')),
      meta,
    });
    page.changePage(1);
    fixture.detectChanges();
    expect(element.textContent).toContain('Backend result [20]: IMPORTED');
    expect(element.textContent).toContain('Created question #120, version 20');
    select(new File([JSON.stringify([quizImportFixture()])], 'new.json'));
    expect(page.outcome()).toBeNull();
    expect(page.importState().status).toBe('idle');
    await vi.waitFor(() => expect(page.state().status).toBe('ready'));
  });
});
