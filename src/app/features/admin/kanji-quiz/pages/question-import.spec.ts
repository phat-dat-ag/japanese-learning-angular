import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuestionImport } from './question-import';
import { quizImportFixture } from '../testing/question-import.fixture';

describe('Question import preview page', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });
  function setup() {
    const fixture = TestBed.createComponent(QuestionImport);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const select = (file: File | null) => {
      Object.defineProperty(input, 'files', { configurable: true, value: { item: () => file } });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, element, select, page: fixture.componentInstance };
  }
  async function waitForRead(page: QuestionImport) {
    await vi.waitFor(() => expect(page.state().status).not.toBe('loading'));
  }
  it('reads locally, preserves the original File, and previews valid and invalid entries', async () => {
    const { fixture, element, select, page } = setup();
    expect(element.textContent).toContain('No file selected');
    const file = new File([JSON.stringify([quizImportFixture(), null])], 'questions.json');
    select(file);
    expect(page.state().status).toBe('loading');
    expect(element.textContent).toContain('Reading and validating');
    await waitForRead(page);
    fixture.detectChanges();
    expect(page.file()).toBe(file);
    expect(element.textContent).toContain(file.name);
    expect(element.textContent).toContain(file.size + ' bytes');
    expect(element.textContent).toContain(
      '2 questions: 1 passed local checks; 1 with validation errors',
    );
    expect(element.textContent).toContain('Array index [0]');
    expect(element.textContent).toContain('Array index [1]');
    expect(element.textContent).toContain('Correct answer');
    expect(element.querySelectorAll('article')[0].querySelectorAll('ol li')).toHaveLength(4);
    expect(element.textContent).toContain('Backend validation is authoritative');
    expect(element.querySelector('button[type="submit"]')).toBeNull();
  });
  it('replaces and clears files, cancels stale reads, and keeps the newest selection', async () => {
    const { fixture, element, select, page } = setup();
    const abort = vi.spyOn(FileReader.prototype, 'abort');
    const first = new File([JSON.stringify([quizImportFixture()])], 'first.json');
    const second = new File(
      [JSON.stringify([quizImportFixture(), quizImportFixture()])],
      'second.json',
    );
    select(first);
    select(second);
    expect(abort).toHaveBeenCalled();
    await waitForRead(page);
    fixture.detectChanges();
    expect(page.file()).toBe(second);
    expect(page.questions()).toHaveLength(2);
    expect(element.textContent).not.toContain('first.json');
    select(first);
    page.clear();
    await new Promise((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();
    expect(page.state().status).toBe('empty');
    expect(page.file()).toBeNull();
    expect(page.questions()).toHaveLength(0);
  });
  it('shows malformed file errors and recovers by reselection', async () => {
    const { fixture, element, select, page } = setup();
    select(new File(['['], 'broken.json'));
    await waitForRead(page);
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Malformed JSON');
    select(new File([JSON.stringify([quizImportFixture()])], 'fixed.json'));
    await waitForRead(page);
    expect(page.questions()).toHaveLength(1);
    expect(page.invalidCount()).toBe(0);
  });
  it('handles file read errors and allows retrying the retained File', async () => {
    const { fixture, element, select, page } = setup();
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementationOnce(function (
      this: FileReader,
    ) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    const file = new File([JSON.stringify([quizImportFixture()])], 'retry.json');
    select(file);
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to read');
    expect(page.file()).toBe(file);
    page.retry();
    await waitForRead(page);
    expect(page.state().status).toBe('ready');
  });
  it('paginates every original index and resets pagination when replacing a file', async () => {
    const { fixture, element, select, page } = setup();
    const values = Array.from({ length: 41 }, () => quizImportFixture());
    select(new File([JSON.stringify(values)], 'many.json'));
    await waitForRead(page);
    fixture.detectChanges();
    expect(element.querySelectorAll('article')).toHaveLength(20);
    page.changePage(2);
    fixture.detectChanges();
    expect(element.querySelectorAll('article')).toHaveLength(1);
    expect(element.textContent).toContain('Array index [40]');
    page.changePage(3);
    expect(page.page()).toBe(2);
    select(new File([JSON.stringify([quizImportFixture()])], 'one.json'));
    await waitForRead(page);
    expect(page.page()).toBe(0);
    expect(page.questions()).toHaveLength(1);
  });
  it('does not clear the current file when the picker is cancelled and renders untrusted text safely', async () => {
    const { fixture, element, select, page } = setup();
    const value = quizImportFixture();
    const file = new File(
      [
        JSON.stringify([
          { ...value, content: { ...value.content, explanationEn: '<script>alert(1)</script>' } },
        ]),
      ],
      'safe.json',
    );
    select(file);
    await waitForRead(page);
    select(null);
    fixture.detectChanges();
    expect(page.file()).toBe(file);
    expect(element.querySelector('script')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });
  it('recovers after a synchronous file-reader failure without terminating selection', async () => {
    const { select, page } = setup();
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementationOnce(() => {
      throw new DOMException('Read failed');
    });
    const file = new File([JSON.stringify([quizImportFixture()])], 'retry.json');
    select(file);
    expect(page.state().status).toBe('error');
    select(file);
    await waitForRead(page);
    expect(page.state().status).toBe('ready');
  });
});
