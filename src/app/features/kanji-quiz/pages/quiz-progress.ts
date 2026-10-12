import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';
import { QuizPlayerNav } from '../components/quiz-player-nav';
import { QuizProgressBreakdownTable } from '../components/quiz-progress-breakdown';
import { QuizProgress as Progress, QuizProgressBreakdown } from '../models/quiz-progress.model';
import { quizReportError, QuizReportState } from '../models/quiz-report-state';
import { QuizPlayerService } from '../services/quiz-player.service';

@Component({
  selector: 'app-quiz-progress',
  imports: [DecimalPipe, QuizPlayerNav, QuizProgressBreakdownTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-progress.html',
})
export class QuizProgress {
  private readonly service = inject(QuizPlayerService);
  private readonly reloadOverall = new Subject<void>();
  private readonly reloadBreakdown = new Subject<void>();
  readonly overall = toSignal(
    this.reloadOverall.pipe(
      startWith(undefined),
      switchMap(() =>
        this.service.getProgress().pipe(
          map(({ data }): QuizReportState<Progress> => ({ status: 'loaded', data })),
          catchError((error: unknown) => of<QuizReportState<Progress>>(quizReportError(error))),
          startWith<QuizReportState<Progress>>({ status: 'loading' }),
        ),
      ),
    ),
    { requireSync: true },
  );
  readonly breakdown = toSignal(
    this.reloadBreakdown.pipe(
      startWith(undefined),
      switchMap(() =>
        this.service.getProgressBreakdown().pipe(
          map(({ data }): QuizReportState<QuizProgressBreakdown> => ({ status: 'loaded', data })),
          catchError((error: unknown) =>
            of<QuizReportState<QuizProgressBreakdown>>(quizReportError(error)),
          ),
          startWith<QuizReportState<QuizProgressBreakdown>>({ status: 'loading' }),
        ),
      ),
    ),
    { requireSync: true },
  );

  retryOverall(): void {
    this.reloadOverall.next();
  }
  retryBreakdown(): void {
    this.reloadBreakdown.next();
  }
}
