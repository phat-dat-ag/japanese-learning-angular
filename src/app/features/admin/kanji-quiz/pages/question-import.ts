import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, startWith, Subject, switchMap } from 'rxjs';
import { QuestionImportResult, QUIZ_PREVIEW_PAGE_SIZE } from '../models/question-import.model';
import { QuestionImportService } from '../services/question-import.service';

type PreviewState = { readonly status: 'empty' | 'loading' } | QuestionImportResult;

@Component({
  selector: 'app-question-import',
  imports: [RouterLink],
  templateUrl: './question-import.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionImport {
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
    if (!(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.item(0);
    if (!file) return;
    this.file.set(file);
    this.page.set(0);
    this.selection.next(file);
    // Allow reselecting the same corrected file without replacing the retained File object.
    event.target.value = '';
  }

  clear(): void {
    this.file.set(null);
    this.page.set(0);
    this.selection.next(null);
  }

  retry(): void {
    if (this.state().status === 'loading') return;
    this.page.set(0);
    this.selection.next(this.file());
  }

  changePage(page: number): void {
    if (Number.isInteger(page) && page >= 0 && page < this.pageCount()) this.page.set(page);
  }
}
