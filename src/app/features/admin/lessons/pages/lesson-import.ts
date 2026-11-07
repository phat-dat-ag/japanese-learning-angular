import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, map, of, startWith, switchMap } from 'rxjs';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { grammarImportError, GrammarImportFeedback } from '../models/lesson-import-error';
import {
  GRAMMAR_IMPORT_MODES,
  GrammarImportMode,
  GrammarImportPreview,
  GrammarImportResponse,
} from '../models/lesson-import.model';
import { LessonContentImportService } from '../services/lesson-content-import.service';

type PreviewState = GrammarImportPreview | { readonly status: 'idle' | 'reading' };
interface ImportOutcome {
  readonly filename: string;
  readonly mode: GrammarImportMode;
  readonly report: GrammarImportResponse;
}
@Component({
  selector: 'app-admin-lesson-import',
  imports: [FormsModule, RouterLink],
  templateUrl: './lesson-import.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonImport {
  private readonly service = inject(LessonContentImportService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selections = new BehaviorSubject<File | null>(null);
  readonly file = toSignal(this.selections, { requireSync: true });
  readonly preview = toSignal(
    this.selections.pipe(
      switchMap((file) =>
        file
          ? this.service.preview(file).pipe(
              map((state): PreviewState => state),
              startWith<PreviewState>({ status: 'reading' }),
            )
          : of<PreviewState>({ status: 'idle' }),
      ),
    ),
    { requireSync: true },
  );
  readonly mode = signal<GrammarImportMode>('SKIP_EXISTING');
  readonly modes = GRAMMAR_IMPORT_MODES;
  readonly submitting = signal(false);
  readonly consumed = signal(false);
  readonly feedback = signal<GrammarImportFeedback | null>(null);
  readonly outcome = signal<ImportOutcome | null>(null);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly authorized = computed(
    () => this.session.authenticated() && this.session.user()?.role === 'Admin',
  );
  readonly canSubmit = computed(
    () =>
      this.authorized() &&
      !this.submitting() &&
      !this.consumed() &&
      this.preview().status === 'ready',
  );
  selectFile(event: Event): void {
    if (this.submitting() || !(event.target instanceof HTMLInputElement)) return;
    this.consumed.set(false);
    this.feedback.set(null);
    this.selections.next(event.target.files?.item(0) ?? null);
  }
  changeMode(value: string): void {
    if (this.submitting()) return;
    const mode = GRAMMAR_IMPORT_MODES.find((mode) => mode === value);
    if (mode) this.mode.set(mode);
  }
  submit(): void {
    const file = this.file();
    if (!file || !this.canSubmit()) return;
    const mode = this.mode();
    this.submitting.set(true);
    this.feedback.set(null);
    this.service
      .importFile(file, mode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.outcome.set({ filename: file.name, mode, report: response.data });
          this.submitting.set(false);
          this.consumed.set(true);
          this.resetFileInput();
        },
        error: (error: unknown) => {
          const feedback = grammarImportError(error);
          this.feedback.set(feedback);
          this.submitting.set(false);
          this.consumed.set(feedback.kind === 'uncertain');
          if (feedback.kind === 'uncertain') this.resetFileInput();
        },
      });
  }
  canLeave(): boolean {
    return !this.submitting();
  }
  private resetFileInput(): void {
    const input = this.fileInput();
    if (input) input.nativeElement.value = '';
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.submitting()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
