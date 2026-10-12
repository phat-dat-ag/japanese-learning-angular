import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { QuizQuestionListResponse, QuizQuestionQuery } from '../models/quiz-question.model';
import { QuizQuestionService } from '../services/quiz-question.service';

type QueryResult = { query: QuizQuestionQuery; error?: never } | { error: string; query?: never };
type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: QuizQuestionListResponse };

const idFilters = ['levelId', 'lessonId', 'vocabularyId', 'exampleId'] as const;

function parseQuery(params: ParamMap): QueryResult {
  const sourceType = params.get('sourceType') || undefined;
  const status = params.get('status') || undefined;
  if (sourceType !== undefined && sourceType !== 'EXAMPLE' && sourceType !== 'CUSTOM') {
    return { error: 'Choose EXAMPLE or CUSTOM as the question type.' };
  }
  if (
    status !== undefined &&
    status !== 'DRAFT' &&
    status !== 'PUBLISHED' &&
    status !== 'ARCHIVED'
  ) {
    return { error: 'Choose DRAFT, PUBLISHED, or ARCHIVED as the status.' };
  }
  const ids: Partial<Record<(typeof idFilters)[number], number>> = {};
  for (const key of idFilters) {
    const value = params.get(key);
    if (!value) continue;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      return { error: 'Filter IDs must be positive whole numbers.' };
    }
    ids[key] = Number(value);
  }
  const keyword = params.get('keyword')?.trim() || undefined;
  if (keyword && keyword.length > 200)
    return { error: 'Search must contain at most 200 characters.' };
  const pageText = params.get('page') ?? '0';
  const sizeText = params.get('size') ?? '20';
  const page = Number(pageText);
  const size = Number(sizeText);
  if (
    !/^\d+$/.test(pageText) ||
    !/^\d+$/.test(sizeText) ||
    !Number.isSafeInteger(page) ||
    size < 1 ||
    size > 100 ||
    (page + 1) * size > 2147483647
  ) {
    return {
      error:
        'Page must be nonnegative and page size must be 1-100, within the server pagination limit.',
    };
  }
  return { query: { sourceType, status, ...ids, keyword, page, size } };
}

@Component({
  selector: 'app-question-bank',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-bank.html',
})
export class QuestionBank {
  private readonly service = inject(QuizQuestionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new Subject<void>();
  private readonly resultsHeading = viewChild<ElementRef<HTMLHeadingElement>>('resultsHeading');
  readonly pageSizes = [20, 50, 100];
  readonly idFields = [
    { key: 'levelId', label: 'JLPT level ID' },
    { key: 'lessonId', label: 'Lesson ID' },
    { key: 'vocabularyId', label: 'Vocabulary ID' },
    { key: 'exampleId', label: 'Example ID' },
  ] as const;
  filters = {
    sourceType: '',
    status: '',
    keyword: '',
    levelId: '',
    lessonId: '',
    vocabularyId: '',
    exampleId: '',
  };

  private readonly queryChanges = this.route.queryParamMap.pipe(
    tap((params) => {
      this.filters = {
        sourceType: params.get('sourceType') ?? '',
        status: params.get('status') ?? '',
        keyword: params.get('keyword') ?? '',
        levelId: params.get('levelId') ?? '',
        lessonId: params.get('lessonId') ?? '',
        vocabularyId: params.get('vocabularyId') ?? '',
        exampleId: params.get('exampleId') ?? '',
      };
    }),
    map(parseQuery),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly queryResult = toSignal(this.queryChanges, { requireSync: true });
  readonly state = toSignal(
    this.queryChanges.pipe(
      switchMap((result) => {
        if (!result.query) return of<ListState>({ status: 'error', message: result.error });
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.listQuestions(result.query).pipe(
              map((response): ListState => ({ status: 'loaded', data: response.data })),
              catchError((error: unknown) => {
                let message = 'Unable to load questions. Please try again.';
                if (error instanceof ApiError) {
                  if (error.status === 401)
                    message = 'Your session could not be verified. Please sign in again.';
                  if (error.status === 403)
                    message = 'You do not have permission to view these questions.';
                  if (error.status === 400)
                    message =
                      'The server rejected these filters. Check the filter values or clear them.';
                }
                return of<ListState>({ status: 'error', message });
              }),
              startWith<ListState>({ status: 'loading' }),
            ),
          ),
        );
      }),
    ),
    { requireSync: true },
  );

  applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.filters,
        keyword: this.filters.keyword.trim(),
        page: 0,
        size: this.queryResult().query?.size ?? 20,
      },
    });
  }

  resetFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: 0, size: this.queryResult().query?.size ?? 20 },
    });
  }

  changeSize(value: string): void {
    const size = Number(value);
    const query = this.queryResult().query;
    if (!query || !this.pageSizes.includes(size) || query.size === size) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...query, page: 0, size },
    });
  }

  changePage(page: number): void {
    const state = this.state();
    const query = this.queryResult().query;
    if (
      !query ||
      state.status !== 'loaded' ||
      !Number.isSafeInteger(page) ||
      page < 0 ||
      page >= Math.max(1, state.data.totalPages) ||
      page === state.data.page ||
      (page + 1) * (query.size ?? 20) > 2147483647
    )
      return;
    this.resultsHeading()?.nativeElement.focus();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...query, page } });
  }

  retry(): void {
    this.resultsHeading()?.nativeElement.focus();
    this.reload.next();
  }
}
