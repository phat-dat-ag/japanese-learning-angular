import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, Observable, of, skip, Subject, switchMap, takeUntil, map } from 'rxjs';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { JlptLevel } from '../../../flashcard/models/jlpt-level.model';
import { FlashcardLesson } from '../../../flashcard/models/flashcard-lesson.model';
import { JlptLevelService } from '../../../flashcard/services/jlpt-level.service';
import { LessonService } from '../../../flashcard/services/lesson.service';
import { AdditionState, additionError } from '../models/vocabulary-add-state';
import { VocabularyDetailData } from '../models/vocabulary-detail.model';
import {
  MetadataKind,
  MetadataSelection,
  MetadataSubmission,
  MetadataUpdate,
} from '../models/vocabulary-metadata.model';
import { VocabularyService } from '../services/vocabulary.service';
import { VocabularySection } from './vocabulary-section';
import { VocabularyAddFeedback } from './vocabulary-add-feedback';
import { VocabularyPitchAccentForm } from './vocabulary-pitch-accent-form';
import { VocabularyLevelAssignmentForm } from './vocabulary-level-assignment-form';
import { VocabularyLessonAssignmentForm } from './vocabulary-lesson-assignment-form';
import { VocabularyPartOfSpeechForm } from './vocabulary-part-of-speech-form';

const labels = {
  'pitch-accents': {
    title: 'Pitch Accents',
    singular: 'pitch accent',
    description: 'Manage accent patterns for each reading.',
  },
  levels: {
    title: 'JLPT Levels',
    singular: 'level assignment',
    description: 'Manage assigned levels and their display order.',
  },
  lessons: {
    title: 'Lessons',
    singular: 'lesson assignment',
    description: 'Manage lesson assignments independently of each lesson’s own order.',
  },
  'parts-of-speech': {
    title: 'Parts of Speech',
    singular: 'part of speech',
    description: 'Assign existing parts of speech to this vocabulary.',
  },
} as const;

@Component({
  selector: 'app-vocabulary-metadata-section',
  imports: [
    VocabularySection,
    VocabularyAddFeedback,
    VocabularyPitchAccentForm,
    VocabularyLevelAssignmentForm,
    VocabularyLessonAssignmentForm,
    VocabularyPartOfSpeechForm,
  ],
  templateUrl: './vocabulary-metadata-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyMetadataSection {
  readonly kind = input.required<MetadataKind>();
  readonly detail = input.required<VocabularyDetailData>();
  readonly updated = output<MetadataUpdate>();
  readonly label = computed(() => labels[this.kind()]);
  readonly selection = signal<MetadataSelection | null>(null);
  readonly formOpen = signal(false);
  readonly operation = signal<'add' | 'edit'>('add');
  readonly state = signal<AdditionState>({ status: 'idle' });
  readonly locked = computed(() =>
    ['saving', 'refreshing', 'refresh-error'].includes(this.state().status),
  );
  readonly busy = computed(() => ['saving', 'refreshing'].includes(this.state().status));
  readonly fields = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.fields : {};
  });
  readonly selectedPitch = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'pitch-accents' ? selected.item : null;
  });
  readonly selectedLevel = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'levels' ? selected.item : null;
  });
  readonly selectedLesson = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'lessons' ? selected.item : null;
  });
  readonly levels = signal<readonly JlptLevel[]>([]);
  readonly lessons = signal<readonly FlashcardLesson[]>([]);
  readonly choicesState = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  private readonly service = inject(VocabularyService);
  private readonly levelService = inject(JlptLevelService);
  private readonly lessonService = inject(LessonService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly closed = new Subject<void>();
  private readonly lessonLevel = new Subject<string>();
  private lastLevel = '';
  private returnFocus: HTMLButtonElement | null = null;

  constructor() {
    this.lessonLevel
      .pipe(
        switchMap((level) => {
          this.lessons.set([]);
          this.choicesState.set(level ? 'loading' : 'idle');
          return level
            ? this.lessonService.getLessons(level).pipe(
              map((response) => ({ status: 'loaded' as const, items: response.data })),
              catchError(() => of({ status: 'error' as const, items: [] })),
              takeUntil(this.closed),
            )
            : of({ status: 'idle' as const, items: [] });
        }),
        takeUntil(this.route.paramMap.pipe(skip(1))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.lessons.set(result.items);
        this.choicesState.set(result.status);
      });
  }

  open(): void {
    if (this.formOpen() || this.locked()) return;
    this.selection.set(null);
    this.operation.set('add');
    this.returnFocus = null;
    this.state.set({ status: 'idle' });
    this.choicesState.set('idle');
    this.lessons.set([]);
    this.lastLevel = '';
    this.formOpen.set(true);
    if (this.kind() === 'levels') this.loadLevels();
  }

  edit(selection: MetadataSelection, button: HTMLButtonElement): void {
    if (this.formOpen() || this.locked() || selection.kind !== this.kind()) return;
    this.selection.set(selection);
    this.operation.set('edit');
    this.returnFocus = button;
    this.state.set({ status: 'idle' });
    this.choicesState.set('idle');
    this.formOpen.set(true);
  }

  cancel(): void {
    if (this.locked()) return;
    this.state.set({ status: 'idle' });
    this.finish();
  }

  loadLessons(level: string): void {
    this.lastLevel = level;
    this.lessonLevel.next(level);
  }

  retryChoices(): void {
    if (this.kind() === 'levels') this.loadLevels();
    else this.loadLessons(this.lastLevel);
  }

  private loadLevels(): void {
    this.choicesState.set('loading');
    this.levels.set([]);
    this.levelService
      .getLevels()
      .pipe(
        takeUntil(this.closed),
        takeUntil(this.route.paramMap.pipe(skip(1))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (levels) => {
          this.levels.set(levels);
          this.choicesState.set('loaded');
        },
        error: () => this.choicesState.set('error'),
      });
  }

  save(submission: MetadataSubmission): void {
    if (!this.formOpen() || this.locked() || submission.kind !== this.kind()) return;
    const id = this.detail().id;
    const selected = this.selection();
    let mutation: Observable<unknown>;

    switch (submission.kind) {
      case 'pitch-accents':
        mutation =
          selected?.kind === 'pitch-accents'
            ? this.service.updatePitchAccent(id, selected.item.pitchAccentId, submission.request)
            : this.service.addPitchAccents(id, [submission.request]);
        break;

      case 'levels':
        mutation =
          selected?.kind === 'levels'
            ? this.service.updateLevel(id, selected.item.levelId, submission.request)
            : this.service.addLevels(id, [submission.request]);
        break;

      case 'lessons':
        mutation =
          selected?.kind === 'lessons'
            ? this.service.updateLesson(id, selected.item.lessonId, submission.request)
            : this.service.addLessons(id, [submission.request]);
        break;

      case 'parts-of-speech':
        mutation = this.service.addPartsOfSpeech(id, [submission.request]);
        break;
    }

    this.state.set({ status: 'saving' });

    this.observe(
      mutation.pipe(
        switchMap(() => {
          this.state.set({ status: 'refreshing' });
          return this.service.getVocabularyDetail(id);
        }),
      ),
    );
  }
  retryRefresh(): void {
    if (this.state().status !== 'refresh-error') return;

    this.state.set({ status: 'refreshing' });
    this.observe(this.service.getVocabularyDetail(this.detail().id));
  }

  private observe(request: Observable<ApiSuccess<VocabularyDetailData>>): void {
    request
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response.data;
          switch (this.kind()) {
            case 'pitch-accents':
              this.updated.emit({ kind: 'pitch-accents', items: data.pitchAccents });
              break;

            case 'levels':
              this.updated.emit({ kind: 'levels', items: data.levels });
              break;

            case 'lessons':
              this.updated.emit({ kind: 'lessons', items: data.lessons });
              break;

            case 'parts-of-speech':
              this.updated.emit({ kind: 'parts-of-speech', items: data.partsOfSpeech });
              break;
          }

          this.state.set({ status: 'saved' });
          this.finish();
        },

        error: (error: unknown) =>
          this.state.set(
            this.state().status === 'refreshing'
              ? { status: 'refresh-error' }
              : additionError(error, this.label().singular, this.operation()),
          ),
      });
  }

  private finish(): void {
    this.closed.next();
    this.formOpen.set(false);
    afterNextRender(
      () =>
        (this.returnFocus?.isConnected
          ? this.returnFocus
          : this.addButton()?.nativeElement
        )?.focus(),
      { injector: this.injector },
    );
  }
}
