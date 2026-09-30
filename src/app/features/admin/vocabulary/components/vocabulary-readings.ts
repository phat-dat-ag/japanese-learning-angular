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
import { Observable, skip, switchMap, takeUntil } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { AdditionState, additionError } from '../models/vocabulary-add-state';
import { VocabularyDetailData, VocabularyReading } from '../models/vocabulary-detail.model';
import { VocabularyReadingUpdateRequest } from '../models/vocabulary-children.model';
import { VocabularyService } from '../services/vocabulary.service';
import { VocabularySection } from './vocabulary-section';
import { VocabularyReadingForm } from './vocabulary-reading-form';
import { VocabularyAddFeedback } from './vocabulary-add-feedback';

@Component({
  selector: 'app-vocabulary-readings',
  imports: [VocabularySection, VocabularyReadingForm, VocabularyAddFeedback],
  templateUrl: './vocabulary-readings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyReadings {
  readonly vocabularyId = input.required<number>();
  readonly items = input.required<readonly VocabularyReading[]>();
  readonly updated = output<readonly VocabularyReading[]>();
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(VocabularyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  readonly formOpen = signal(false);
  readonly selected = signal<VocabularyReading | null>(null);
  readonly operation = signal<'add' | 'edit'>('add');
  private returnFocus: HTMLButtonElement | null = null;
  readonly state = signal<AdditionState>({ status: 'idle' });
  readonly locked = computed(() =>
    ['saving', 'refreshing', 'refresh-error'].includes(this.state().status),
  );
  readonly busy = computed(() => ['saving', 'refreshing'].includes(this.state().status));
  readonly fields = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.fields : {};
  });
  readonly hasPrimary = computed(() =>
    this.items().some((item) => item.isPrimary && item.readingId !== this.selected()?.readingId),
  );

  open(): void {
    if (this.locked()) return;
    this.selected.set(null);
    this.operation.set('add');
    this.returnFocus = null;
    this.state.set({ status: 'idle' });
    this.formOpen.set(true);
  }
  edit(item: VocabularyReading, button: HTMLButtonElement): void {
    if (this.formOpen() || this.locked()) return;
    this.selected.set(item);
    this.operation.set('edit');
    this.returnFocus = button;
    this.state.set({ status: 'idle' });
    this.formOpen.set(true);
  }

  cancel(): void {
    if (this.locked()) return;
    this.state.set({ status: 'idle' });
    this.finish();
  }
  save(request: VocabularyReadingUpdateRequest): void {
    if (!this.formOpen() || this.locked()) return;
    const selected = this.selected();
    const mutation: Observable<unknown> = selected
      ? this.service.updateReading(this.vocabularyId(), selected.readingId, request)
      : this.service.addReadings(this.vocabularyId(), [request]);
    this.state.set({ status: 'saving' });
    this.observe(
      mutation.pipe(
        switchMap(() => {
          this.state.set({ status: 'refreshing' });
          return this.service.getVocabularyDetail(this.vocabularyId());
        }),
      ),
    );
  }
  retryRefresh(): void {
    if (this.state().status !== 'refresh-error') return;
    this.state.set({ status: 'refreshing' });
    this.observe(this.service.getVocabularyDetail(this.vocabularyId()));
  }
  private observe(request: Observable<ApiSuccess<VocabularyDetailData>>): void {
    request
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.updated.emit(response.data.readings);
          this.state.set({ status: 'saved' });
          this.finish();
        },
        error: (error: unknown) =>
          this.state.set(
            this.state().status === 'refreshing'
              ? { status: 'refresh-error' }
              : additionError(error, 'reading', this.operation()),
          ),
      });
  }
  private finish(): void {
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
