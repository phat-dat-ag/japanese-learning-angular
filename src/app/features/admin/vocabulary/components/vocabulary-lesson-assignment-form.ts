import { VocabularyFormActions } from './vocabulary-form-actions';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnInit,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdditionErrors } from '../models/vocabulary-add-state';
import { validDisplayOrder } from '../models/vocabulary-children.model';
import { VocabularyDetailData } from '../models/vocabulary-detail.model';
import { LessonAssignmentAddRequest } from '../models/vocabulary-metadata.model';
import { FlashcardLesson } from '../../../flashcard/models/flashcard-lesson.model';

@Component({
  selector: 'app-vocabulary-lesson-assignment-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-lesson-assignment-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyLessonAssignmentForm implements OnInit {
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly cancelled = output<void>();
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLSelectElement>>('first');
  private readonly orderInput = viewChild<ElementRef<HTMLInputElement>>('orderInput');
  
  constructor() {
    afterNextRender(() =>
      (this.first()?.nativeElement ?? this.orderInput()?.nativeElement)?.focus(),
    );
  }

  readonly initial = input<VocabularyDetailData['lessons'][number] | null>(null);
  readonly levels = input.required<VocabularyDetailData['levels']>();
  readonly loading = input(false);
  readonly choicesLoaded = input(false);
  readonly options = input<readonly FlashcardLesson[]>([]);
  readonly levelChanged = output<string>();
  readonly submitted = output<LessonAssignmentAddRequest>();
  level = '';
  lessonId: number | null = null;
  displayOrder: number | null = null;

  ngOnInit(): void {
    const item = this.initial();
    if (item) {
      this.lessonId = item.lessonId;
      this.displayOrder = item.assignmentDisplayOrder;
    }
  }

  validOrder(value: number | null): value is number {
    return validDisplayOrder(value) && value >= 1;
  }

  changeLevel(value: string): void {
    this.level = value;
    this.lessonId = null;
    this.levelChanged.emit(value);
  }

  get validLevel(): boolean {
    return this.levels().some((item) => item.code === this.level);
  }

  get validLesson(): boolean {
    return (
      this.initial() !== null ||
      (this.validLevel && this.options().some((item) => item.id === this.lessonId))
    );
  }

  get valid(): boolean {
    return this.validOrder(this.displayOrder) && this.validLesson;
  }

  submit(): void {
    if (
      this.locked() ||
      !this.valid ||
      this.lessonId === null ||
      !this.validOrder(this.displayOrder)
    )
      return;
    this.submitted.emit({ lessonId: this.lessonId, displayOrder: this.displayOrder });
  }
}
