import { vocabularyLoadError } from '../models/vocabulary-load-error';
import { VocabularyExamples } from '../components/vocabulary-examples';
import { VocabularyKanjiSection } from '../components/vocabulary-kanji';
import { VocabularyExample, VocabularyKanji } from '../models/vocabulary-detail.model';
import { VocabularyMetadataSection } from '../components/vocabulary-metadata-section';
import { MetadataKind, MetadataUpdate } from '../models/vocabulary-metadata.model';
import {
  VocabularyDetailData,
  VocabularyReading,
  VocabularyMeaning,
} from '../models/vocabulary-detail.model';
import { VocabularyReadings } from '../components/vocabulary-readings';
import { VocabularyMeanings } from '../components/vocabulary-meanings';
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
  scan,
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
  VocabularyCoreUpdateRequest,
} from '../models/vocabulary-core.model';
import { VocabularyService } from '../services/vocabulary.service';

type DetailState =
  | { readonly status: 'invalid' | 'loading' | 'missing' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'loaded'; readonly core: VocabularyDetailData };

type SaveState =
  | { readonly status: 'idle' | 'saving' | 'refreshing' | 'saved' | 'refresh-error' }
  | { readonly status: 'error'; readonly message: string; readonly fields: CoreFieldErrors };

@Component({
  selector: 'app-admin-vocabulary-detail',
  imports: [
    RouterLink,
    VocabularyHeader,
    VocabularySection,
    VocabularyCoreForm,
    VocabularyReadings,
    VocabularyMeanings,
    VocabularyMetadataSection,
    VocabularyExamples,
    VocabularyKanjiSection,
  ],
  templateUrl: './vocabulary-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(VocabularyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reload = new Subject<void>();
  private readonly updated = new Subject<(detail: VocabularyDetailData) => VocabularyDetailData>();
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
                  of<DetailState>(
                    error instanceof ApiError && error.status === 404
                      ? { status: 'missing' }
                      : {
                        status: 'error',
                        message: vocabularyLoadError(
                          error,
                          'Unable to load vocabulary details. Please try again.',
                        ),
                      },
                  ),
                ),

                startWith<DetailState>({ status: 'loading' }),
              ),
            ),
          ),
          this.updated,
        ).pipe(
          scan(
            (
              state: DetailState,
              update: DetailState | ((detail: VocabularyDetailData) => VocabularyDetailData),
            ): DetailState => {
              if (typeof update !== 'function') return update;
              if (state.status !== 'loaded') return state;
              return { status: 'loaded', core: update(state.core) };
            },
            { status: 'loading' } as DetailState,
          ),
        );
      }),
    ),

    { initialValue: { status: 'loading' } as DetailState },
  );

  readonly metadataSections: readonly MetadataKind[] = [
    'pitch-accents',
    'levels',
    'lessons',
    'parts-of-speech',
  ];

  updateMetadata(update: MetadataUpdate): void {
    this.updated.next((detail) => {
      switch (update.kind) {
        case 'pitch-accents':
          return {
            ...detail,
            pitchAccents: update.items.map((accent) => ({
              ...accent,
              reading:
                detail.readings.find((reading) => reading.readingId === accent.readingId)
                  ?.reading ?? accent.reading,
            })),
          };

        case 'levels':
          return { ...detail, levels: update.items };

        case 'lessons':
          return { ...detail, lessons: update.items };

        case 'parts-of-speech':
          return { ...detail, partsOfSpeech: update.items };
      }
    });
  }

  updateReadings(readings: readonly VocabularyReading[]): void {
    this.updated.next((detail) => ({
      ...detail,
      readings,
      pitchAccents: detail.pitchAccents.map((accent) => ({
        ...accent,
        reading:
          readings.find((reading) => reading.readingId === accent.readingId)?.reading ??
          accent.reading,
      })),
    }));
  }

  updateExamples(examples: readonly VocabularyExample[]): void {
    this.updated.next((detail) => ({ ...detail, examples }));
  }

  updateKanji(kanji: readonly VocabularyKanji[]): void {
    this.updated.next((detail) => ({
      ...detail,
      // A metadata refresh must not replace a newer nested-reading refresh.
      kanji: kanji.map((item) => ({
        ...item,
        readings:
          detail.kanji.find((current) => current.kanjiId === item.kanjiId)?.readings ??
          item.readings,
      })),
    }));
  }

  updateKanjiReadings(update: {
    readonly kanjiId: number;
    readonly readings: VocabularyKanji['readings'];
  }): void {
    this.updated.next((detail) => ({
      ...detail,
      kanji: detail.kanji.map((item) =>
        item.kanjiId === update.kanjiId ? { ...item, readings: update.readings } : item,
      ),
    }));
  }

  updateMeanings(meanings: readonly VocabularyMeaning[]): void {
    this.updated.next((detail) => ({ ...detail, meanings }));
  }

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

    if (state.status !== 'loaded' || this.saveState().status !== 'refresh-error')
      return;

    this.saveState.set({ status: 'refreshing' });
    this.observeUpdate(this.service.getVocabularyDetail(state.core.id));
  }

  private observeUpdate(request: Observable<ApiSuccess<VocabularyDetailData>>): void {
    request
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const { id, word, normalizedWord } = response.data;

          this.updated.next((detail) => ({ ...detail, id, word, normalizedWord }));
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
