import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  map,
  merge,
  Observable,
  of,
  skip,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { VocabularyHeader } from '../components/vocabulary-header';
import { VocabularySection } from '../components/vocabulary-section';
import { VocabularyCoreForm } from '../components/vocabulary-core-form';
import {
  CoreFieldErrors,
  validCoreText,
  VocabularyCore,
  VocabularyCoreUpdateRequest,
} from '../models/vocabulary-core.model';
import { VocabularyService } from '../services/vocabulary.service';

type DetailState =
  | { readonly status: 'invalid' | 'loading' | 'missing' | 'error' }
  | { readonly status: 'loaded'; readonly core: VocabularyCore };
type SaveState =
  | { readonly status: 'idle' | 'saving' | 'refreshing' | 'saved' | 'refresh-error' }
  | { readonly status: 'error'; readonly message: string; readonly fields: CoreFieldErrors };

@Component({
  selector: 'app-admin-vocabulary-detail',
  imports: [RouterLink, VocabularyHeader, VocabularySection, VocabularyCoreForm],
  templateUrl: './vocabulary-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(VocabularyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reload = new Subject<void>();
  private readonly updated = new Subject<VocabularyCore>();
  private readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');
  readonly editing = signal(false);
  readonly saveState = signal<SaveState>({ status: 'idle' });
  readonly locked = computed(() =>
    ['saving', 'refreshing', 'refresh-error'].includes(this.saveState().status),
  );
  readonly busy = computed(() => ['saving', 'refreshing'].includes(this.saveState().status));
  readonly fieldErrors = computed(() => {
    const state = this.saveState();
    return state.status === 'error' ? state.fields : {};
  });

  readonly state = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const raw = params.get('vocabularyId') ?? '';
        const id = Number(raw);
        return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : null;
      }),
      distinctUntilChanged(),
      switchMap((id) => {
        this.editing.set(false);
        this.saveState.set({ status: 'idle' });
        if (id === null) return of<DetailState>({ status: 'invalid' });
        return merge(
          this.reload.pipe(
            startWith(undefined),
            switchMap(() =>
              this.service.getVocabularyDetail(id).pipe(
                map((response): DetailState => ({ status: 'loaded', core: response.data })),
                catchError((error: unknown) =>
                  of<DetailState>({
                    status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
                  }),
                ),
                startWith<DetailState>({ status: 'loading' }),
              ),
            ),
          ),
          this.updated.pipe(map((core): DetailState => ({ status: 'loaded', core }))),
        );
      }),
    ),
    { initialValue: { status: 'loading' } as DetailState },
  );

  retry(): void {
    this.reload.next();
  }

  edit(): void {
    if (this.state().status !== 'loaded' || this.locked()) return;
    this.saveState.set({ status: 'idle' });
    this.editing.set(true);
  }

  cancel(): void {
    if (this.locked()) return;
    this.saveState.set({ status: 'idle' });
    this.finishEditing();
  }

  save(request: VocabularyCoreUpdateRequest): void {
    const state = this.state();
    if (
      state.status !== 'loaded' ||
      !this.editing() ||
      this.locked() ||
      !validCoreText(request.word) ||
      !validCoreText(request.normalizedWord)
    )
      return;
    this.saveState.set({ status: 'saving' });
    this.observeUpdate(
      this.service.updateVocabularyCore(state.core.id, request).pipe(
        switchMap(() => {
          this.saveState.set({ status: 'refreshing' });
          return this.service.getVocabularyDetail(state.core.id);
        }),
      ),
    );
  }

  retryRefresh(): void {
    const state = this.state();
    if (state.status !== 'loaded' || this.saveState().status !== 'refresh-error') return;
    this.saveState.set({ status: 'refreshing' });
    this.observeUpdate(this.service.getVocabularyDetail(state.core.id));
  }

  private observeUpdate(request: Observable<ApiSuccess<VocabularyCore>>): void {
    request
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.updated.next(response.data);
          this.saveState.set({ status: 'saved' });
          this.finishEditing();
        },
        error: (error: unknown) => {
          if (this.saveState().status === 'refreshing') {
            this.saveState.set({ status: 'refresh-error' });
            return;
          }
          this.saveState.set(this.saveError(error));
        },
      });
  }

  private saveError(error: unknown): SaveState {
    const fields: Partial<Record<keyof VocabularyCoreUpdateRequest, string>> = {};
    let message = 'Unable to save changes. Please try again.';
    if (error instanceof ApiError) {
      switch (error.status) {
        case 400:
          message = 'Please check the core information and try again.';
          for (const detail of error.details) {
            if (detail.field === 'word' || detail.field === 'normalizedWord')
              fields[detail.field] =
                'The server rejected this value. Please check it and try again.';
          }
          break;
        case 401:
          message = 'Your session could not be verified. Please sign in again.';
          break;
        case 403:
          message = 'You do not have permission to update this vocabulary.';
          break;
        case 404:
          message = 'This vocabulary no longer exists. Return to Vocabulary Management.';
          break;
        case 409:
          message = 'This normalized word is already used by another vocabulary.';
          fields.normalizedWord = 'Choose a different normalized word.';
          break;
      }
    }
    return { status: 'error', message, fields };
  }

  private finishEditing(): void {
    this.editing.set(false);
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
