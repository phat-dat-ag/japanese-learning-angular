import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { ApiMeta, ApiValidationError } from '../../../core/api/api-response.model';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { FileImportService, validateImportFile } from './file-import.service';
import { ImportKind, LessonBatchResponse, VocabularyImportResult } from './import.models';

type ImportOutcome =
  | {
    readonly filename: string;
    readonly kind: 'vocabulary';
    readonly data: VocabularyImportResult;
    readonly meta: ApiMeta;
  }
  | {
    readonly filename: string;
    readonly kind: 'lessons';
    readonly data: LessonBatchResponse;
    readonly meta: ApiMeta;
  };

interface ImportFeedback {
  readonly message: string;
  readonly details: readonly ApiValidationError[];
  readonly meta?: ApiMeta;
}

@Component({
  selector: 'app-admin-file-import',
  imports: [RouterLink],
  templateUrl: './file-import.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileImport {
  private readonly service = inject(FileImportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(AuthSession);
  readonly kind: ImportKind =
    inject(ActivatedRoute).snapshot.data['importKind'] === 'lessons' ? 'lessons' : 'vocabulary';
  readonly title = this.kind === 'lessons' ? 'Lesson Management' : 'Import Vocabulary';
  readonly file = signal<File | null>(null);
  readonly submitting = signal(false);
  readonly feedback = signal<ImportFeedback | null>(null);
  readonly outcome = signal<ImportOutcome | null>(null);
  readonly canImport = computed(
    () => this.session.authenticated() && this.session.user()?.role === 'Admin',
  );
  readonly fileError = computed(() => validateImportFile(this.file(), this.kind));

  selectFile(event: Event): void {
    if (this.submitting() || !(event.target instanceof HTMLInputElement)) return;
    this.file.set(event.target.files?.item(0) ?? null);
    // Keep previous results visible while choosing a corrected file.
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;

    if (!this.canImport()) {
      this.feedback.set({
        message:
          'An Admin session is required to import files. Please sign in with an Admin account.',
        details: [],
      });
      return;
    }

    const file = this.file();
    const validation = this.fileError();

    if (!file || validation) {
      this.feedback.set({ message: validation ?? 'Choose a file.', details: [] });
      return;
    }

    this.submitting.set(true);
    this.feedback.set(null);

    const request =
      this.kind === 'lessons'
        ? this.service.importLessons(file).pipe(
          map((response): ImportOutcome => ({
            kind: 'lessons',
            filename: file.name,
            ...response,
          })),
        )
        : this.service.importVocabulary(file).pipe(
          map((response): ImportOutcome => ({
            kind: 'vocabulary',
            filename: file.name,
            ...response,
          })),
        );

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (outcome) => {
        this.outcome.set(outcome);
        this.submitting.set(false);
        this.file.set(null);
        const input = event.target instanceof HTMLFormElement ? event.target : null;
        input?.reset();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.feedback.set(this.importError(error));
      },
    });
  }

  private importError(error: unknown): ImportFeedback {
    let message = 'The import could not be confirmed. Check the current data before retrying.';
    let details: readonly ApiValidationError[] = [];

    if (error instanceof ApiError) {
      switch (error.status) {
        case 400:
          message = error.message;
          details = error.details;
          break;
        case 401:
          message = 'Your session could not be verified. Please sign in again.';
          break;
        case 403:
          message = 'You do not have permission to import files. An Admin account is required.';
          break;
        case 413:
          message =
            this.kind === 'lessons'
              ? 'The upload exceeds the 1 MiB lesson file limit.'
              : 'The upload exceeds the server’s configured request-size limit.';
          break;
        case 415:
          message = 'The server rejected the upload format. Choose a file containing a JSON array.';
          break;
      }

      if (error.status === 400 && this.kind === 'vocabulary')
        message += ' No vocabulary changes were saved.';

      if (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE') {
        message +=
          this.kind === 'lessons'
            ? ' Some lessons may already have been created. Retrying the whole file can cause conflicts.'
            : ' The atomic import may already have completed.';
      }

      return { message, details, meta: error.meta };
    }
    return { message, details };
  }
}
