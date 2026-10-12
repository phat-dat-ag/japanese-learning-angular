import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { breakdown, progress } from '../testing/quiz-report.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { QuizProgress } from './quiz-progress';

describe('QuizProgress', () => {
  let fixture: ComponentFixture<QuizProgress>;
  let http: HttpTestingController;
  const base = '/api/v1/kanji-quiz/progress';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(QuizProgress);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('renders backend overall metrics independently from overlapping breakdown rows', () => {
    http.expectOne(base).flush(success(progress));
    http.expectOne(base + '/breakdown').flush(success(breakdown));
    fixture.detectChanges();
    const summary: HTMLElement = fixture.nativeElement.querySelector(
      '[aria-labelledby=overall-title]',
    );
    expect(
      Array.from(summary.querySelectorAll('dd')).map((value) => value.textContent?.trim()),
    ).toEqual(['2', '6', '4', '2', '66.67%', '3', '2.00']);
    expect(summary.textContent).toContain('2026-10-12 10:15:30 UTC');
    expect(fixture.nativeElement.textContent).toContain('do not add these rows together');
  });

  it('keeps UNKNOWN and UNASSIGNED distinct and retains moved lesson classification pairs', () => {
    http.expectOne(base).flush(success(progress));
    http.expectOne(base + '/breakdown').flush(success(breakdown));
    fixture.detectChanges();
    const tables: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('table'));
    for (const table of tables) {
      expect(table.textContent).toContain('UNKNOWN — classification not captured');
      expect(table.textContent).toContain('UNASSIGNED — captured without an assignment');
      expect(table.querySelectorAll('tbody tr')).toHaveLength(4);
    }
    expect(tables[1].textContent).toContain('Level ID 1 / Lesson ID 10');
    expect(tables[1].textContent).toContain('Level ID 2 / Lesson ID 10');
  });

  it('shows a useful empty dashboard', () => {
    http.expectOne(base).flush(
      success({
        completedSessions: 0,
        answeredCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        accuracyPercentage: 0,
        bestScore: 0,
        averageScore: 0,
        latestCompletedAt: null,
      }),
    );
    http.expectOne(base + '/breakdown').flush(success({ levels: [], lessons: [] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Complete a game');
    expect(fixture.nativeElement.textContent).toContain('No completed-session classifications');
    expect(fixture.nativeElement.textContent).toContain('0.00%');
  });

  it.each(['overall', 'breakdown'])(
    'retains successful data when %s fails and retries only that request',
    (failed) => {
      const overall = http.expectOne(base);
      const detail = http.expectOne(base + '/breakdown');
      if (failed === 'overall') {
        overall.error(new ProgressEvent('error'));
        detail.flush(success(breakdown));
      } else {
        overall.flush(success(progress));
        detail.flush(null, { status: 500, statusText: 'Failure' });
      }
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        failed === 'overall' ? 'Level ID 1' : '66.67%',
      );
      fixture.nativeElement.querySelector('button').click();
      if (failed === 'overall') {
        http.expectOne(base).flush(success(progress));
        http.expectNone(base + '/breakdown');
      } else {
        http.expectOne(base + '/breakdown').flush(success(breakdown));
        http.expectNone(base);
      }
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    },
  );

  it.each([401, 403])(
    'handles authorization HTTP %s without exposing data or backend details',
    (status) => {
      for (const path of [base, base + '/breakdown']) {
        http.expectOne(path).flush(
          {
            success: false,
            error: { code: 'ERROR', message: 'Private details', details: [] },
            meta,
          },
          { status, statusText: 'Failure' },
        );
      }
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[role=alert]')).toHaveLength(2);
      expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
      expect(fixture.nativeElement.querySelector('table')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Private details');
    },
  );

  it('cancels obsolete overall refreshes without disturbing breakdown data', () => {
    const stale = http.expectOne(base);
    http.expectOne(base + '/breakdown').flush(success(breakdown));
    fixture.componentInstance.retryOverall();
    expect(stale.cancelled).toBe(true);
    http.expectOne(base).flush(success(progress));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Level ID 1');
  });
});
