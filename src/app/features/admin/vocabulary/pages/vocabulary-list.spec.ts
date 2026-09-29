import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VocabularyList } from './vocabulary-list';

const meta = { timestamp: '2026-09-29T00:00:00Z', traceId: 'trace', correlationId: 'correlation' };
const firstPage = {
  flashcardItems: [{ id: 42, word: '日本語' }],
  page: 0,
  size: 20,
  totalElements: 21,
  totalPages: 2,
};
const lesson = { id: 7, lessonNumber: 2, title: 'Greetings', description: 'Lesson description' };
const listUrl = '/api/v1/flashcards?page=0&size=20';

describe('Admin vocabulary list', () => {
  let fixture: ComponentFixture<VocabularyList>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VocabularyList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VocabularyList);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function levels(): void {
    http.expectOne('/api/v1/jlpt-levels').flush({
      success: true,
      data: [
        { code: 'N5', name: 'Beginner' },
        { code: 'N4', name: 'Elementary' },
      ],
      meta,
    });
    fixture.detectChanges();
  }
  function flushList(url = listUrl, data = firstPage): void {
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data, meta });
    fixture.detectChanges();
  }
  function select(id: string, value: string): void {
    const control = element.querySelector<HTMLSelectElement>('#' + id)!;
    control.value = value;
    control.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  function button(text: string): HTMLButtonElement {
    const result = Array.from(element.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === text,
    );
    expect(result).toBeDefined();
    return result!;
  }

  it('shows loading then real words, IDs, totals, and accessible management links', () => {
    expect(element.textContent).toContain('Loading vocabulary');
    expect(element.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector<HTMLSelectElement>('#vocabulary-lesson')?.disabled).toBe(true);
    levels();
    flushList();
    expect(element.textContent).toContain('日本語');
    expect(element.textContent).toContain('Vocabulary ID 42');
    expect(element.textContent).toContain('21 entries');
    expect(element.textContent).toContain('Page 1 of 2');
    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/admin/vocabulary/42');
    expect(link?.getAttribute('aria-label')).toContain('日本語');
    expect(element.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('false');
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
    http.expectNone('/api/v1/flashcards/42');
  });

  it('renders an empty collection without errors or a fictional page count', () => {
    levels();
    flushList(listUrl, { ...firstPage, flashcardItems: [], totalElements: 0, totalPages: 0 });
    expect(element.textContent).toContain('No vocabulary found');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('[aria-label="Vocabulary pagination"]')).toBeNull();
  });

  it('hides backend diagnostics and retries the current request', () => {
    levels();
    http.expectOne(listUrl).flush(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'private diagnostic', details: [] },
        meta,
      },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load vocabulary',
    );
    expect(element.textContent).not.toContain('private diagnostic');
    button('Try again').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading vocabulary');
    flushList();
  });

  it('rejects malformed vocabulary payloads through the shared API validation', () => {
    levels();
    http.expectOne(listUrl).flush({
      success: true,
      data: { ...firstPage, flashcardItems: [{ id: 0, word: 'Invalid' }] },
      meta,
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to load vocabulary');
    expect(element.querySelector('a')).toBeNull();
  });

  it('uses backend pagination, disables boundaries, and retries the failed page', () => {
    levels();
    flushList();
    button('Next').click();
    fixture.detectChanges();
    expect(element.querySelector('a')).toBeNull();
    http
      .expectOne('/api/v1/flashcards?page=1&size=20')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    button('Try again').click();
    flushList('/api/v1/flashcards?page=1&size=20', { ...firstPage, page: 1 });
    expect(element.textContent).toContain('Page 2 of 2');
    expect(button('Next').disabled).toBe(true);
    button('Next').click();
    http.expectNone(() => true);
    button('Previous').click();
    flushList();
  });

  it('maps level and lesson filters, resets pages, and clears incompatible lessons', () => {
    levels();
    flushList();
    button('Next').click();
    flushList('/api/v1/flashcards?page=1&size=20', { ...firstPage, page: 1 });
    select('vocabulary-level', 'N5');
    expect(element.querySelector<HTMLSelectElement>('#vocabulary-lesson')?.disabled).toBe(true);
    http.expectOne('/api/v1/lessons?level=n5').flush({ success: true, data: [lesson], meta });
    flushList('/api/v1/flashcards?level=N5&page=0&size=20');
    select('vocabulary-lesson', '7');
    flushList('/api/v1/flashcards?lesson=7&level=N5&page=0&size=20');
    button('Next').click();
    flushList('/api/v1/flashcards?lesson=7&level=N5&page=1&size=20', { ...firstPage, page: 1 });
    select('vocabulary-level', 'N4');
    expect(element.querySelector<HTMLSelectElement>('#vocabulary-lesson')?.value).toBe('');
    expect(element.textContent).not.toContain('Greetings');
    http.expectOne('/api/v1/lessons?level=n4').flush({ success: true, data: [], meta });
    flushList('/api/v1/flashcards?level=N4&page=0&size=20');
    expect(element.textContent).toContain('No lessons available for this level');
    button('Clear filters').click();
    flushList();
    expect(element.querySelector<HTMLSelectElement>('#vocabulary-level')?.value).toBe('');
  });

  it('resets pagination when page size changes and preserves selected filters', () => {
    levels();
    flushList();
    select('vocabulary-level', 'N5');
    http.expectOne('/api/v1/lessons?level=n5').flush({ success: true, data: [lesson], meta });
    flushList('/api/v1/flashcards?level=N5&page=0&size=20');
    button('Next').click();
    flushList('/api/v1/flashcards?level=N5&page=1&size=20', { ...firstPage, page: 1 });
    select('vocabulary-size', '50');
    flushList('/api/v1/flashcards?level=N5&page=0&size=50', {
      ...firstPage,
      size: 50,
      totalPages: 1,
    });
    expect(button('Next').disabled).toBe(true);
  });

  it('cancels stale list and lesson requests when filters change', () => {
    levels();
    const initial = http.expectOne(listUrl);
    select('vocabulary-level', 'N5');
    expect(initial.cancelled).toBe(true);
    const oldList = http.expectOne('/api/v1/flashcards?level=N5&page=0&size=20');
    const oldLessons = http.expectOne('/api/v1/lessons?level=n5');
    select('vocabulary-level', 'N4');
    expect(oldList.cancelled).toBe(true);
    expect(oldLessons.cancelled).toBe(true);
    http.expectOne('/api/v1/lessons?level=n4').flush({ success: true, data: [], meta });
    flushList('/api/v1/flashcards?level=N4&page=0&size=20');
  });

  it('keeps vocabulary usable if levels fail and allows retry', () => {
    http.expectOne('/api/v1/jlpt-levels').flush(null, { status: 500, statusText: 'Server Error' });
    flushList();
    expect(element.textContent).toContain('日本語');
    expect(element.textContent).toContain('Unable to load levels');
    button('Retry levels').click();
    levels();
    http.expectNone(() => true);
  });

  it('allows lesson retry without refetching the vocabulary list', () => {
    levels();
    flushList();
    select('vocabulary-level', 'N5');
    http
      .expectOne('/api/v1/lessons?level=n5')
      .flush(null, { status: 500, statusText: 'Server Error' });
    flushList('/api/v1/flashcards?level=N5&page=0&size=20');
    expect(element.textContent).toContain('Unable to load lessons');
    button('Retry lessons').click();
    http.expectOne('/api/v1/lessons?level=n5').flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Greetings');
    http.expectNone(() => true);
  });

  it('offers a first-page recovery if the collection shrinks past the current page', () => {
    levels();
    flushList();
    button('Next').click();
    flushList('/api/v1/flashcards?page=1&size=20', {
      ...firstPage,
      page: 1,
      flashcardItems: [],
      totalElements: 0,
      totalPages: 0,
    });
    expect(element.textContent).not.toContain('Page 2 of 0');
    expect(element.textContent).toContain('This page is no longer available');
    button('Return to first page').click();
    flushList(listUrl, { ...firstPage, flashcardItems: [], totalElements: 0, totalPages: 0 });
  });
  it('cancels pending requests when destroyed', () => {
    const levelRequest = http.expectOne('/api/v1/jlpt-levels');
    const listRequest = http.expectOne(listUrl);
    fixture.destroy();
    expect(levelRequest.cancelled).toBe(true);
    expect(listRequest.cancelled).toBe(true);
  });
});
