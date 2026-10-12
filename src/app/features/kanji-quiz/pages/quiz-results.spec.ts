import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { historyDetail } from '../testing/quiz-report.fixture';
import { session } from '../testing/quiz-gameplay.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { QuizResults } from './quiz-results';

describe('QuizResults', () => {
  let fixture: ComponentFixture<QuizResults>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const base = '/api/v1/kanji-quiz';
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ sessionId: '42' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    fixture = TestBed.createComponent(QuizResults);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function completed(id = 42): void {
    http
      .expectOne(base + '/sessions/' + id)
      .flush(success({ ...session, sessionId: id, status: 'COMPLETED', answeredCount: 2 }));
  }
  function load(id = 42): void {
    completed(id);
    http
      .expectOne(base + '/history/' + id)
      .flush(success({ ...historyDetail, session: { ...historyDetail.session, sessionId: id } }));
    fixture.detectChanges();
  }

  it('renders authoritative totals, dates, original review snapshots, and Unicode targets', () => {
    expect(fixture.nativeElement.textContent).toContain('Loading results');
    load();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Session 42');
    expect(text).toContain('2026-10-12 10:15:30.123456 UTC');
    expect(text).toContain('Original level: Not recorded');
    expect(text).toContain('Incorrect');
    expect(text).toContain('Correct');
    expect(text).toContain('学生');
    expect(text).toContain('学校');
    expect(text).toContain('Trường học');
    const marks: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('mark'));
    expect(marks.map((mark) => mark.textContent)).toEqual(['がっこう', 'がっこう']);
    const summary: HTMLElement = fixture.nativeElement.querySelector('dl');
    expect(
      Array.from(summary.querySelectorAll('dd')).map((element) => element.textContent?.trim()),
    ).toEqual(['1', '2', '1', '1']);
  });

  it('does not derive summary scores from visible review questions', () => {
    completed();
    http.expectOne(base + '/history/42').flush(success({ ...historyDetail, questions: [] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No question review is available');
    expect(fixture.nativeElement.querySelector('dl dd').textContent).toBe('1');
  });

  it('offers resume for an incomplete session without fetching answer-bearing history', () => {
    http.expectOne(base + '/sessions/42').flush(success(session));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('not completed');
    expect(fixture.nativeElement.querySelector('a[href="/kanji-quiz/sessions/42"]')).not.toBeNull();
    http.expectNone(base + '/history/42');
  });

  it('does not offer results for abandoned sessions', () => {
    http.expectOne(base + '/sessions/42').flush(success({ ...session, status: 'ABANDONED' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ended without completion');
    http.expectNone(base + '/history/42');
  });

  it('restores results after refresh', () => {
    load();
    fixture.destroy();
    fixture = TestBed.createComponent(QuizResults);
    load();
    expect(fixture.nativeElement.textContent).toContain('Question review');
  });

  it('cancels stale detail requests when route IDs change', () => {
    completed();
    const pending = http.expectOne(base + '/history/42');
    params.next(convertToParamMap({ sessionId: '73' }));
    expect(pending.cancelled).toBe(true);
    load(73);
    expect(fixture.nativeElement.textContent).toContain('Session 73');
    expect(fixture.nativeElement.textContent).not.toContain('Session 42');
  });

  it.each(['0', '-1', 'abc', '9007199254740992'])('blocks invalid session ID %s', (id) => {
    const pending = http.expectOne(base + '/sessions/42');
    params.next(convertToParamMap({ sessionId: id }));
    fixture.detectChanges();
    expect(pending.cancelled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Invalid session ID');
    http.expectNone(base + '/sessions/' + id);
  });

  it.each([401, 403, 404])('shows a safe unavailable state for HTTP %s', (status) => {
    completed();
    http.expectOne(base + '/history/42').flush(
      {
        success: false,
        error: { code: 'ERROR', message: 'Private details', details: [] },
        meta,
      },
      { status, statusText: 'Failure' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Private details');
    expect(fixture.nativeElement.querySelector('app-quiz-question-review')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('retries a failed detail read by restoring the current session first', () => {
    completed();
    http.expectOne(base + '/history/42').error(new ProgressEvent('error'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    load();
  });
});
