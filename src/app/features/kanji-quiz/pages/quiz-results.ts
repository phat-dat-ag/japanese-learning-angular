import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { QuizPlayerNav } from '../components/quiz-player-nav';
import { QuizQuestionReview } from '../components/quiz-question-review';
import { QuizHistoryDetail } from '../models/quiz-history.model';
import { quizReportError, QuizReportState } from '../models/quiz-report-state';
import { QuizPlayerService } from '../services/quiz-player.service';

type ResultsState =
  | QuizReportState<QuizHistoryDetail>
  | { readonly status: 'invalid' | 'incomplete' | 'abandoned'; readonly sessionId: number | null };

@Component({
  selector: 'app-quiz-results',
  imports: [RouterLink, QuizPlayerNav, QuizQuestionReview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-results.html',
})
export class QuizResults {
  private readonly service = inject(QuizPlayerService);
  private readonly reload = new Subject<void>();
  readonly state = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const value = params.get('sessionId');
        return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
          ? Number(value)
          : null;
      }),
      distinctUntilChanged(),
      switchMap((id) => {
        if (id === null) return of<ResultsState>({ status: 'invalid', sessionId: null });
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getSession(id).pipe(
              switchMap(({ data }) => {
                if (data.status !== 'COMPLETED') {
                  return of<ResultsState>({
                    status: data.status === 'IN_PROGRESS' ? 'incomplete' : 'abandoned',
                    sessionId: id,
                  });
                }
                return this.service
                  .getHistoryDetail(id)
                  .pipe(map(({ data }): ResultsState => ({ status: 'loaded', data })));
              }),
              catchError((error: unknown) => of<ResultsState>(quizReportError(error))),
              startWith<ResultsState>({ status: 'loading' }),
            ),
          ),
        );
      }),
    ),
    { requireSync: true },
  );

  retry(): void {
    this.reload.next();
  }
}
