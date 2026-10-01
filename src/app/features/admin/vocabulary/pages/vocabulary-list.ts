import { vocabularyLoadError } from '../models/vocabulary-load-error';
import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  map,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { FlashcardLesson } from '../../../flashcard/models/flashcard-lesson.model';
import { JlptLevel } from '../../../flashcard/models/jlpt-level.model';
import { JlptLevelService } from '../../../flashcard/services/jlpt-level.service';
import { LessonService } from '../../../flashcard/services/lesson.service';
import { VocabularyFilters } from '../components/vocabulary-filters';
import { VocabularyHeader } from '../components/vocabulary-header';
import { LoadState, VocabularyPage, VocabularyQuery } from '../models/vocabulary.model';
import { VocabularyService } from '../services/vocabulary.service';

@Component({
  selector: 'app-admin-vocabulary-list',
  imports: [RouterLink, VocabularyHeader, VocabularyFilters],
  templateUrl: './vocabulary-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyList {
  private readonly vocabulary = inject(VocabularyService);
  private readonly levels = inject(JlptLevelService);
  private readonly lessons = inject(LessonService);
  private readonly queryChanges = new BehaviorSubject<VocabularyQuery>({ page: 0, size: 20 });
  private readonly reload = new Subject<void>();
  private readonly levelReload = new Subject<void>();
  private readonly lessonReload = new Subject<void>();

  private readonly resultsHeading = viewChild<ElementRef<HTMLHeadingElement>>('resultsHeading');

  readonly query = toSignal(this.queryChanges, { requireSync: true });
  readonly pageSizes = [20, 50, 100] as const;
  readonly levelState = toSignal(
    this.levelReload.pipe(
      startWith(undefined),
      switchMap(() =>
        this.levels.getLevels().pipe(
          map((data): LoadState<readonly JlptLevel[]> => ({ status: 'loaded', data })),
          catchError(() => of<LoadState<readonly JlptLevel[]>>({ status: 'error' })),
          startWith<LoadState<readonly JlptLevel[]>>({ status: 'loading' }),
        ),
      ),
    ),
    { requireSync: true },
  );

  readonly lessonState = toSignal(
    this.queryChanges.pipe(
      map((query) => query.level),
      distinctUntilChanged(),
      switchMap((level) => {
        if (!level)
          return of<LoadState<readonly FlashcardLesson[]>>({ status: 'loaded', data: [] });
        return this.lessonReload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.lessons.getLessons(level).pipe(
              map((response): LoadState<readonly FlashcardLesson[]> => ({
                status: 'loaded',
                data: response.data,
              })),
              catchError(() => of<LoadState<readonly FlashcardLesson[]>>({ status: 'error' })),
              startWith<LoadState<readonly FlashcardLesson[]>>({ status: 'loading' }),
            ),
          ),
        );
      }),
    ),
    { requireSync: true },
  );

  readonly state = toSignal(
    this.queryChanges.pipe(
      switchMap((query) =>
        this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.vocabulary.getVocabularyList(query).pipe(
              map((response): LoadState<VocabularyPage> => ({
                status: 'loaded',
                data: response.data,
              })),
              catchError((error: unknown) =>
                of<LoadState<VocabularyPage>>({
                  status: 'error',
                  message: vocabularyLoadError(
                    error,
                    'Unable to load vocabulary. Please try again.',
                  ),
                }),
              ),
              startWith<LoadState<VocabularyPage>>({ status: 'loading' }),
            ),
          ),
        ),
      ),
    ),
    { requireSync: true },
  );

  changeLevel(level: string): void {
    if (level === (this.query().level ?? '')) return;
    const levels = this.levelState();
    if (level && (levels.status !== 'loaded' || !levels.data.some((item) => item.code === level)))
      return;
    this.queryChanges.next({ page: 0, size: this.query().size, level: level || undefined });
  }

  changeLesson(value: string): void {
    const lesson = value ? Number(value) : undefined;
    const lessons = this.lessonState();
    if (
      lesson !== undefined &&
      (lessons.status !== 'loaded' || !lessons.data.some((item) => item.id === lesson))
    )
      return;
    if (lesson === this.query().lesson) return;
    this.queryChanges.next({ ...this.query(), lesson, page: 0 });
  }

  changeSize(value: string): void {
    const size = this.pageSizes.find((item) => item === Number(value));
    if (!size || size === this.query().size) return;
    this.queryChanges.next({ ...this.query(), size, page: 0 });
  }

  changePage(page: number): void {
    const state = this.state();
    if (
      state.status !== 'loaded' ||
      !Number.isSafeInteger(page) ||
      page < 0 ||
      page >= Math.max(1, state.data.totalPages) ||
      page === state.data.page
    )
      return;
    this.resultsHeading()?.nativeElement.focus();
    this.queryChanges.next({ ...this.query(), page });
  }

  resetFilters(): void {
    this.queryChanges.next({ page: 0, size: this.query().size });
  }

  retry(): void {
    this.resultsHeading()?.nativeElement.focus();
    this.reload.next();
  }

  retryLevels(): void {
    this.levelReload.next();
  }

  retryLessons(): void {
    this.lessonReload.next();
  }
}
