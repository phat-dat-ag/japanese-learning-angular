import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { LESSON_LEVELS, LessonLevelCode, LessonMetadata } from '../models/lesson.model';
import { grammarReadError } from '../models/grammar-read-error';
import { LessonReadService } from '../services/lesson-read.service';

type LessonListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; lessons: readonly LessonMetadata[] };
@Component({
  selector: 'app-grammar-lessons',
  imports: [RouterLink],
  templateUrl: './grammar-lessons.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarLessons {
  private readonly service = inject(LessonReadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new Subject<void>();
  readonly levels = LESSON_LEVELS;
  private readonly levelChanges = this.route.queryParamMap.pipe(
    map((params) => LESSON_LEVELS.find((code) => code === params.get('level')) ?? 'N5'),
    distinctUntilChanged(),
  );
  readonly level = toSignal(this.levelChanges, { initialValue: 'N5' as LessonLevelCode });
  readonly state = toSignal(
    this.levelChanges.pipe(
      switchMap((level) =>
        this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getLessons(level).pipe(
              map((response): LessonListState => ({ status: 'ready', lessons: response.data })),
              catchError((error: unknown) =>
                of<LessonListState>({ status: 'error', message: grammarReadError(error) }),
              ),
              startWith<LessonListState>({ status: 'loading' }),
            ),
          ),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as LessonListState },
  );

  changeLevel(value: string): void {
    if (value === this.level() || !LESSON_LEVELS.some((code) => code === value))
      return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { level: value },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this.reload.next();
  }
}
