import { filter, firstValueFrom } from 'rxjs';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { QuizQuestionListResponse, QuizQuestionResponse } from '../models/quiz-question.model';
import { QuestionBank } from './question-bank';

const path = '/admin/kanji-quiz/questions';
const endpoint = '/api/v1/admin/kanji-quiz/questions';
const meta = { timestamp: '2026-10-11T00:00:00Z', traceId: 'trace', correlationId: 'correlation' };
const question: QuizQuestionResponse = {
  id: 42,
  version: 3,
  sourceType: 'CUSTOM',
  status: 'DRAFT',
  sentenceReading: 'がっこうへいく',
  targetReading: 'がっこう',
  targetStart: 0,
  targetLength: 4,
  sourceInvalidated: false,
  eligibleForNewGames: false,
  levelIds: [8],
  lessonIds: [7],
  vocabularyId: 12,
  options: [],
  createdAt: '2026-10-10T12:00:00',
  updatedAt: '2026-10-11T12:00:00',
};
const firstPage: QuizQuestionListResponse = {
  items: [question],
  page: 0,
  size: 20,
  totalElements: 21,
  totalPages: 2,
};

describe('Kanji Quiz Question Bank', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/kanji-quiz/questions', component: QuestionBank }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function open(query = ''): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path + query, QuestionBank);
    harness.detectChanges();
  }
  function request(): TestRequest {
    return http.expectOne((req) => req.url.startsWith(endpoint));
  }
  function flush(req = request(), data = firstPage): void {
    req.flush({ success: true, data, meta });
    harness.detectChanges();
  }
  function element(): HTMLElement {
    return harness.routeNativeElement!;
  }
  function button(label: string): HTMLButtonElement {
    const result = Array.from(element().querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(result).toBeDefined();
    return result!;
  }
  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  function input(id: string, value: string): void {
    const control = element().querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
    control.value = value;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
  }

  it('renders loading, summaries, actual metadata, and working view details without mutation links', async () => {
    await open();
    expect(element().textContent).toContain('Loading questions');
    expect(element().querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');
    flush();
    expect(element().textContent).toContain('がっこうへいく');
    expect(element().textContent).toContain('CUSTOM');
    expect(element().textContent).toContain('DRAFT');
    expect(element().textContent).toContain('21 questions');
    expect(element().textContent).toContain('Page 1 of 2');
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
    element().querySelector('summary')?.click();
    expect(element().querySelector('details')?.open).toBe(true);
    expect(element().querySelector('a[href="/admin/vocabulary/12"]')).not.toBeNull();
    expect(element().querySelector('a[href$="/new"], a[href$="/edit"]')).toBeNull();
  });

  it('applies all supported filters together, resets the page, and avoids duplicate requests', async () => {
    await open('?page=1');
    flush(request(), { ...firstPage, page: 1 });
    input('question-type', 'EXAMPLE');
    input('question-status', 'PUBLISHED');
    input('question-levelId', '8');
    input('question-lessonId', '7');
    input('question-vocabularyId', '12');
    input('question-exampleId', '4');
    input('question-keyword', '  がっこう  ');
    button('Apply filters').click();
    await settle();
    const req = request();
    const params = new URL(req.request.url, 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toEqual({
      sourceType: 'EXAMPLE',
      status: 'PUBLISHED',
      levelId: '8',
      lessonId: '7',
      vocabularyId: '12',
      exampleId: '4',
      keyword: 'がっこう',
      page: '0',
      size: '20',
    });
    flush(req);
    button('Apply filters').click();
    await settle();
    http.expectNone((req) => req.url.startsWith(endpoint));
    button('Clear filters').click();
    await settle();
    const cleared = request();
    expect(cleared.request.url).toBe(endpoint + '?page=0&size=20');
    flush(cleared);
  });

  it('navigates server pages, changes size, and restores URL state', async () => {
    await open('?status=ARCHIVED');
    flush();
    button('Next').click();
    await settle();
    let req = request();
    expect(req.request.url).toContain('page=1&size=20');
    flush(req, { ...firstPage, page: 1 });
    expect(button('Next').disabled).toBe(true);
    expect(document.activeElement?.id).toBe('results-heading');
    input('question-size', '50');
    await settle();
    req = request();
    expect(req.request.url).toContain('page=0&size=50');
    flush(req, { ...firstPage, size: 50, totalPages: 1 });
    await harness.navigateByUrl(path + '?sourceType=EXAMPLE&page=2&size=10', QuestionBank);
    req = request();
    expect(req.request.url).toContain('sourceType=EXAMPLE&page=2&size=10');
    flush(req, { ...firstPage, page: 2, size: 10, totalPages: 3 });
    expect(element().querySelector<HTMLSelectElement>('#question-type')?.value).toBe('EXAMPLE');
    expect(element().querySelector<HTMLSelectElement>('#question-size')?.value).toBe('10');
  });

  it('handles no results and recovers when a requested page no longer exists', async () => {
    await open('?page=5');
    flush(request(), { items: [], page: 5, size: 20, totalElements: 0, totalPages: 0 });
    expect(element().textContent).toContain('No questions found');
    expect(element().textContent).toContain('no longer available');
    button('Return to first page').click();
    await settle();
    flush(request(), { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    expect(element().textContent).toContain('0 questions');
    expect(element().querySelector('nav[aria-label="Question pagination"]')).toBeNull();
  });

  it('renders missing example sentences and source invalidation independently from status', async () => {
    await open();
    flush(request(), {
      ...firstPage,
      items: [
        {
          ...question,
          sourceType: 'EXAMPLE',
          status: 'PUBLISHED',
          sentenceReading: undefined,
          exampleId: 4,
          sourceInvalidated: true,
        },
      ],
    });
    expect(element().textContent).toContain('Sentence unavailable');
    expect(element().textContent).toContain('PUBLISHED');
    expect(element().textContent).toContain('Source invalidated');
    expect(element().textContent).toContain('Not eligible for new games');
  });

  it.each([
    'sourceType=OTHER',
    'status=OTHER',
    'levelId=-1',
    'lessonId=1.5',
    'exampleId=9007199254740992',
    'vocabularyId=abc',
    'page=-1',
    'size=101',
    'size=0',
    'page=2147483647',
    'keyword=' + 'x'.repeat(201),
  ])('rejects invalid URL filters: %s', async (query) => {
    await open('?' + query);
    expect(element().querySelector('[role="alert"]')).not.toBeNull();
    http.expectNone((req) => req.url.startsWith(endpoint));
    button('Clear filters').click();
    await settle();
    flush();
  });

  it.each([400, 401, 403, 500])(
    'shows safe errors and retries the current query after HTTP %s',
    async (status) => {
      await open('?status=DRAFT');
      request().flush({ private: 'secret diagnostics' }, { status, statusText: 'Failure' });
      harness.detectChanges();
      expect(element().querySelector('[role="alert"]')).not.toBeNull();
      expect(element().textContent).not.toContain('secret diagnostics');
      button('Try again').click();
      harness.detectChanges();
      expect(element().textContent).toContain('Loading questions');
      const req = request();
      expect(req.request.url).toContain('status=DRAFT');
      flush(req);
    },
  );

  it('restores filters and pagination through browser Back and Forward', async () => {
    await open('?status=DRAFT');
    // The harness navigates directly; application bootstrap normally installs this listener.
    TestBed.inject(Router).initialNavigation();
    flush();
    button('Next').click();
    await settle();
    flush(request(), { ...firstPage, page: 1 });
    const back = firstValueFrom(
      TestBed.inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    TestBed.inject(Location).back();
    await back;
    await settle();
    let req = request();
    expect(req.request.url).toContain('status=DRAFT&page=0&size=20');
    flush(req);
    expect(element().textContent).toContain('Page 1 of 2');
    const forward = firstValueFrom(
      TestBed.inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    TestBed.inject(Location).forward();
    await forward;
    await settle();
    req = request();
    expect(req.request.url).toContain('status=DRAFT&page=1&size=20');
    flush(req, { ...firstPage, page: 1 });
    expect(element().textContent).toContain('Page 2 of 2');
  });

  it('rejects invalid entered IDs without sending a request and allows correction', async () => {
    await open();
    flush();
    input('question-levelId', '-2');
    button('Apply filters').click();
    await settle();
    expect(element().textContent).toContain('Filter IDs must be positive whole numbers');
    http.expectNone((req) => req.url.startsWith(endpoint));
    input('question-levelId', '8');
    button('Apply filters').click();
    await settle();
    const req = request();
    expect(req.request.url).toContain('levelId=8');
    flush(req);
  });

  it('cancels an in-flight request when the page is destroyed', async () => {
    await open();
    const req = request();
    harness.fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
  it('cancels stale filter and page requests, rendering only the latest response', async () => {
    await open();
    const initial = request();
    await harness.navigateByUrl(path + '?sourceType=CUSTOM', QuestionBank);
    expect(initial.cancelled).toBe(true);
    const filtered = request();
    await harness.navigateByUrl(path + '?sourceType=EXAMPLE&page=1', QuestionBank);
    expect(filtered.cancelled).toBe(true);
    flush(request(), {
      ...firstPage,
      page: 1,
      items: [{ ...question, id: 99, sourceType: 'EXAMPLE' }],
    });
    expect(element().textContent).toContain('Question #99');
    expect(element().textContent).not.toContain('Question #42');
    expect(() => initial.flush({ success: true, data: firstPage, meta })).toThrow();
    expect(TestBed.inject(Router).url).toContain('page=1');
  });
});
