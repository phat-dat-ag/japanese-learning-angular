import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';

import { BookmarkState } from '../../services/bookmark-state';
import { BookmarkButton } from '../../components/bookmark-button';
import { ProgressSummary } from '../../components/progress-summary';
import { FlashcardLearningService } from '../../services/flashcard-learning.service';
import { LearningStatistics } from '../../models/learning.model';
import { learningView, LearningViewState } from '../../models/learning-view-state';
import { FlashcardPage } from '../../models/flashcard-page.model';
import { FlashcardService } from '../../services/flashcard.service';
import { FlashcardLesson } from '../../models/flashcard-lesson.model';
import { LessonService } from '../../services/lesson.service';

type StudyState =
  | { readonly status: 'loading'; readonly levelId: string }
  | {
    readonly status: 'loaded';
    readonly levelId: string;
    readonly lesson: FlashcardLesson;
    readonly cards: FlashcardPage;
  }
  | { readonly status: 'missing'; readonly levelId: string }
  | { readonly status: 'error'; readonly levelId: string };

@Component({
  selector: 'app-study',
  imports: [RouterLink, ProgressSummary, BookmarkButton],
  providers: [BookmarkState],
  templateUrl: './study.html',
  host: { '(window:focus)': 'retry()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Study {
  readonly bookmarks = inject(BookmarkState);
  private readonly route = inject(ActivatedRoute);
  private readonly lessonService = inject(LessonService);
  private readonly flashcardService = inject(FlashcardService);
  private readonly pageChanges = new Subject<number>();
  private readonly reload = new Subject<void>();

  readonly state = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const levelId = (params.get('level') ?? '').toLowerCase();
        const lessonId = Number(params.get('lessonId'));
        if (!/^n[1-5]$/.test(levelId) || !Number.isSafeInteger(lessonId) || lessonId <= 0) {
          return of<StudyState>({ status: 'missing', levelId });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.lessonService.getLessons(levelId).pipe(
              switchMap((response) => {
                const lesson = response.data.find((item) => item.id === lessonId);
                if (!lesson) return of<StudyState>({ status: 'missing', levelId });
                return this.pageChanges.pipe(
                  startWith(0),
                  switchMap((page) =>
                    this.flashcardService
                      .getFlashcards(lesson.lessonNumber, levelId, page, true)
                      .pipe(
                        map((cards): StudyState => ({
                          status: 'loaded',
                          levelId,
                          lesson,
                          cards: cards.data,
                        })),
                        startWith<StudyState>({ status: 'loading', levelId }),
                      ),
                  ),
                );
              }),
              catchError(() => of<StudyState>({ status: 'error', levelId })),
              startWith<StudyState>({ status: 'loading', levelId }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading', levelId: '' } as StudyState },
  );

  private readonly learning = inject(FlashcardLearningService);
  readonly progress = toSignal(
    toObservable(this.state).pipe(
      filter((state) => state.status === 'loaded'),
      map((state) => state.lesson.id),
      distinctUntilChanged(),
      switchMap((lessonId) =>
        this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            learningView(this.learning.statistics({ lessonId }).pipe(map((r) => r.data))),
          ),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as LearningViewState<LearningStatistics> },
  );

  changePage(page: number): void {
    const current = this.state();
    if (
      current.status !== 'loaded' ||
      !Number.isSafeInteger(page) ||
      page < 0 ||
      page >= current.cards.totalPages ||
      page === current.cards.page
    )
      return;
    this.pageChanges.next(page);
  }

  retry(): void {
    this.bookmarks.values.set(new Map());
    this.reload.next();
  }
}
