import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError, normalizeApiError } from '../../../../core/api/api-error';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { QuizImportResponse } from '../models/quiz-import.model';
import { QuizQuestionService } from '../services/quiz-question.service';
import {
  QuestionImportResult,
  QUIZ_PREVIEW_PAGE_SIZE,
  validateQuizFile,
} from '../models/question-import.model';
import { QuestionImportService } from '../services/question-import.service';

type ImportState =
  | { readonly status: 'idle' | 'submitting' | 'complete' }
  | { readonly status: 'error'; readonly message: string; readonly error: ApiError };

type PreviewState = { readonly status: 'empty' | 'loading' } | QuestionImportResult;

@Component({
  selector: 'app-question-import',
  imports: [RouterLink],
  templateUrl: './question-import.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class QuestionImport {
  private readonly api = inject(QuizQuestionService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  readonly importState = signal<ImportState>({ status: 'idle' });
  readonly outcome = signal<ApiSuccess<QuizImportResponse> | null>(null);
  readonly submitting = computed(() => this.importState().status === 'submitting');
  readonly canSubmit = computed(() => {
    const file = this.file();
    return (
      !!file &&
      !validateQuizFile(file) &&
      this.state().status === 'ready' &&
      this.invalidCount() === 0 &&
      !this.submitting() &&
      this.session.authenticated() &&
      this.session.user()?.role === 'Admin'
    );
  });
  readonly resultsByIndex = computed(
    () => new Map(this.outcome()?.data.results.map((item) => [item.index, item]) ?? []),
  );
  private readonly service = inject(QuestionImportService);
  private readonly selection = new Subject<File | null>();
  readonly file = signal<File | null>(null);
  readonly state = signal<PreviewState>({ status: 'empty' });
  readonly page = signal(0);
  readonly pageSize = QUIZ_PREVIEW_PAGE_SIZE;
  readonly questions = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.questions : [];
  });
  readonly invalidCount = computed(
    () => this.questions().filter((item) => item.errors.length).length,
  );
  readonly pageCount = computed(() => Math.ceil(this.questions().length / this.pageSize));
  readonly visibleQuestions = computed(() =>
    this.questions().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  constructor() {
    this.selection
      .pipe(
        switchMap((file) =>
          file
            ? this.service.preview(file).pipe(startWith<PreviewState>({ status: 'loading' }))
            : of<PreviewState>({ status: 'empty' }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  selectFile(event: Event): void {
    if (this.submitting() || !(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.item(0);
    if (!file) return;
    this.importState.set({ status: 'idle' });
    this.outcome.set(null);
    this.file.set(file);
    this.page.set(0);
    this.selection.next(file);
    // Allow reselecting the same corrected file without replacing the retained File object.
    event.target.value = '';
  }

  clear(): void {
    if (this.submitting()) return;
    this.importState.set({ status: 'idle' });
    this.outcome.set(null);
    this.file.set(null);
    this.page.set(0);
    this.selection.next(null);
  }

  retry(): void {
    if (this.state().status === 'loading' || this.submitting()) return;
    this.page.set(0);
    this.selection.next(this.file());
  }

  submit(): void {
    const file = this.file();
    if (!file || !this.canSubmit()) return;
    if (
      this.importState().status !== 'idle' &&
      !window.confirm(
        'Retry the entire file? Previously successful questions may be re-imported or reported as duplicates. A failed request may also have committed questions. Check the Question Bank first.',
      )
    )
      return;
    const count = this.questions().length;
    this.importState.set({ status: 'submitting' });
    this.api
      .importQuestions(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.data.total !== count) {
            this.requestFailed(ApiError.invalidResponse(200, response.meta));
            return;
          }
          this.outcome.set(response);
          this.importState.set({ status: 'complete' });
        },
        error: (error: unknown) => this.requestFailed(error),
      });
  }

  canLeave(): boolean {
    return !this.submitting();
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.submitting()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private requestFailed(failure: unknown): void {
    const error = normalizeApiError(failure);
    let message =
      'The import outcome could not be confirmed. Some questions may already have been imported. Check the Question Bank before retrying.';
    if (error.status === 400)
      message =
        'The server rejected the import request before processing questions. Check the file format, media type, and configured question limit.';
    if (error.status === 401)
      message = 'Your session could not be verified. Sign in again before importing.';
    if (error.status === 403)
      message =
        'You do not have permission to import quiz questions. An Admin account is required.';
    if (error.status === 413)
      message =
        'The upload exceeds the server or proxy size limit. Choose a smaller file (client limit: 1 MiB).';
    if (error.status === 415)
      message =
        'The server rejected the upload media type. The import requires a JSON file in multipart form data.';
    this.importState.set({ status: 'error', message, error });
  }

  changePage(page: number): void {
    if (Number.isInteger(page) && page >= 0 && page < this.pageCount()) this.page.set(page);
  }
}
