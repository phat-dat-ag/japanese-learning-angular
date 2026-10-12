import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { QuizPlayerNav } from '../components/quiz-player-nav';
import { QuizHistoryPage } from '../models/quiz-history.model';
import { quizReportError, QuizReportState } from '../models/quiz-report-state';
import { QuizPlayerService } from '../services/quiz-player.service';

type HistoryState = QuizReportState<QuizHistoryPage> | { readonly status: 'invalid' };

@Component({
  selector: 'app-quiz-history',
  imports: [RouterLink, QuizPlayerNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-history.html',
})
export class QuizHistory {
  private readonly service = inject(QuizPlayerService);
  private readonly reload = new Subject<void>();
  readonly state = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((params) => ({ page: params.get('page') ?? '0', size: params.get('size') ?? '20' })),
      distinctUntilChanged((a, b) => a.page === b.page && a.size === b.size),
      switchMap((query) => {
        const page = Number(query.page);
        const size = Number(query.size);
        if (
          !/^\d+$/.test(query.page) ||
          !/^\d+$/.test(query.size) ||
          !Number.isSafeInteger(page) ||
          !Number.isSafeInteger(size) ||
          size < 1 ||
          size > 100 ||
          page * size > 2147483647
        ) {
          return of<HistoryState>({ status: 'invalid' });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getHistory(page, size).pipe(
              map(({ data }): HistoryState => ({ status: 'loaded', data })),
              catchError((error: unknown) => of<HistoryState>(quizReportError(error))),
              startWith<HistoryState>({ status: 'loading' }),
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
