import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { historyPage } from '../testing/quiz-report.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { QuizHistory } from './quiz-history';

describe('QuizHistory', () => {
  let fixture: ComponentFixture<QuizHistory>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const base = '/api/v1/kanji-quiz/history';
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      ],
    });
    fixture = TestBed.createComponent(QuizHistory);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function links(): (string | null)[] {
    const element: HTMLElement = fixture.nativeElement;
    return Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href'));
  }

  it('renders history with results links and backend dates and scores', () => {
    expect(fixture.nativeElement.textContent).toContain('Loading history');
    http.expectOne(base + '?page=0&size=20').flush(success(historyPage));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/kanji-quiz/sessions/42/results"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('2026-10-12 10:15:30.123456');
    expect(fixture.nativeElement.textContent).toContain('1 completed sessions');
  });

  it('uses backend totals and preserves size in pagination links', () => {
    http
      .expectOne(base + '?page=0&size=20')
      .flush(success({ ...historyPage, totalElements: 41, totalPages: 3 }));
    fixture.detectChanges();
    expect(links()).toContain('/kanji-quiz/history?page=1&size=20');
    params.next(convertToParamMap({ page: '1', size: '20' }));
    http
      .expectOne(base + '?page=1&size=20')
      .flush(success({ ...historyPage, page: 1, totalElements: 41, totalPages: 3 }));
    fixture.detectChanges();
    expect(links()).toContain('/kanji-quiz/history?page=2&size=20');
    expect(fixture.nativeElement.textContent).toContain('Previous');
  });

  it('supports direct page URLs and cancels superseded reads', () => {
    const stale = http.expectOne(base + '?page=0&size=20');
    params.next(convertToParamMap({ page: '2', size: '50' }));
    expect(stale.cancelled).toBe(true);
    http
      .expectOne(base + '?page=2&size=50')
      .flush(success({ ...historyPage, page: 2, size: 50, totalPages: 3 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Page 3');
    expect(links()).not.toContain('/kanji-quiz/history?page=3&size=50');
  });

  it.each([0, 1])('handles empty or out-of-range pages with totalElements=%s', (totalElements) => {
    http
      .expectOne(base + '?page=0&size=20')
      .flush(success({ ...historyPage, items: [], totalElements, totalPages: totalElements }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      totalElements ? 'No sessions on this page' : 'No completed games yet',
    );
  });

  it.each([
    { page: '-1', size: '20' },
    { page: 'abc', size: '20' },
    { page: '0', size: '101' },
    { page: '0', size: '0' },
    { page: '2147483647', size: '20' },
  ])('rejects unsupported pagination %o without an API request', (query) => {
    const pending = http.expectOne(base + '?page=0&size=20');
    params.next(convertToParamMap(query));
    expect(pending.cancelled).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invalid history page');
    http.expectNone((request) => request.url.startsWith(base));
  });

  it.each([401, 403, 500])('handles history HTTP %s', (status) => {
    http.expectOne(base + '?page=0&size=20').flush(
      {
        success: false,
        error: { code: 'ERROR', message: 'Private details', details: [] },
        meta,
      },
      { status, statusText: 'Failure' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Private details');
    if (status === 500) {
      fixture.nativeElement.querySelector('button').click();
      http.expectOne(base + '?page=0&size=20').flush(success(historyPage));
    } else {
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
    }
  });
});
