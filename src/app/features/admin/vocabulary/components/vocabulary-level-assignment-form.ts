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
import { LevelAssignmentAddRequest } from '../models/vocabulary-metadata.model';
import { JlptLevel } from '../../../flashcard/models/jlpt-level.model';

@Component({
  selector: 'app-vocabulary-level-assignment-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-level-assignment-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyLevelAssignmentForm implements OnInit {
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

  readonly initial = input<VocabularyDetailData['levels'][number] | null>(null);
  readonly loading = input(false);
  readonly choicesLoaded = input(false);
  readonly options = input<readonly JlptLevel[]>([]);
  readonly submitted = output<LevelAssignmentAddRequest>();
  level = '';
  displayOrder: number | null = null;
  readonly validOrder = validDisplayOrder;
  ngOnInit(): void {
    const item = this.initial();
    if (item) {
      this.level = item.code;
      this.displayOrder = item.displayOrder;
    }
  }
  get validLevel(): boolean {
    return this.initial() !== null || this.options().some((item) => item.code === this.level);
  }
  get valid(): boolean {
    return validDisplayOrder(this.displayOrder) && this.validLevel;
  }
  submit(): void {
    if (this.locked() || !this.valid || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({ level: this.level, displayOrder: this.displayOrder });
  }
}
