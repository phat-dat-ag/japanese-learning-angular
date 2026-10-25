import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  from,
  map,
  mergeMap,
  of,
  scan,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';

import { ProgressSummary } from '../../components/progress-summary';
import { FlashcardLearningService } from '../../services/flashcard-learning.service';
import { LearningStatistics } from '../../models/learning.model';
import { learningView, LearningViewState } from '../../models/learning-view-state';
import { LessonCard } from '../../components/lesson-card/lesson-card';
import { FlashcardLesson } from '../../models/flashcard-lesson.model';
import { LessonService } from '../../services/lesson.service';

type LessonListState =
  | { readonly status: 'invalid' }
  | { readonly status: 'loading'; readonly levelId: string }
  | {
    readonly status: 'loaded';
    readonly levelId: string;
    readonly lessons: readonly FlashcardLesson[];
  }
  | { readonly status: 'error'; readonly levelId: string };

@Component({
  selector: 'app-lesson-list',
  imports: [LessonCard, RouterLink, ProgressSummary],
  host: { '(window:focus)': 'retry()' },
  templateUrl: './lesson-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonList {
  private readonly route = inject(ActivatedRoute);
  private readonly lessonService = inject(LessonService);
  private readonly reload = new Subject<void>();

  readonly state = toSignal(
    this.route.paramMap.pipe(
      map((params) => (params.get('level') ?? '').toLowerCase()),
      distinctUntilChanged(),
      switchMap((levelId) => {
        if (!/^n[1-5]$/.test(levelId)) {
          return of<LessonListState>({ status: 'invalid' });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.lessonService.getLessons(levelId).pipe(
              map((response): LessonListState => ({
                status: 'loaded',
                levelId,
                lessons: response.data,
              })),
              catchError(() => of<LessonListState>({ status: 'error', levelId })),
              startWith<LessonListState>({ status: 'loading', levelId }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading', levelId: '' } as LessonListState },
  );

  private readonly learning = inject(FlashcardLearningService);
  readonly page = linkedSignal({
    source: () => {
      const state = this.state();
      return state.status === 'invalid' ? '' : state.levelId;
    },
    computation: () => 0,
  });
  readonly visibleLessons = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    const start = Math.min(
      this.page() * 12,
      Math.max(0, Math.ceil(state.lessons.length / 12) - 1) * 12,
    );
    return state.lessons.slice(start, start + 12);
  });
  readonly progress = toSignal(
    toObservable(this.visibleLessons).pipe(
      switchMap((lessons) =>
        from(lessons).pipe(
          mergeMap(
            (lesson) =>
              learningView(
                this.learning.statistics({ lessonId: lesson.id }).pipe(map((r) => r.data)),
              ).pipe(map((state) => ({ id: lesson.id, state }))),
            3,
          ),
          scan(
            (all, entry) => ({ ...all, [entry.id]: entry.state }),
            {} as Readonly<Record<number, LearningViewState<LearningStatistics>>>,
          ),
          startWith({} as Readonly<Record<number, LearningViewState<LearningStatistics>>>),
        ),
      ),
    ),
    { initialValue: {} as Readonly<Record<number, LearningViewState<LearningStatistics>>> },
  );

  retry(): void {
    this.reload.next();
  }
}
