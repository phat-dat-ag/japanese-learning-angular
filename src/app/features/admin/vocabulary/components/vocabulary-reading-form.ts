import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdditionErrors } from '../models/vocabulary-add-state';
import {
  validDisplayOrder,
  VocabularyReadingUpdateRequest,
} from '../models/vocabulary-children.model';
import { validVocabularyText } from '../models/vocabulary-validation';

@Component({
  selector: 'app-vocabulary-reading-form',
  imports: [FormsModule],
  templateUrl: './vocabulary-reading-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyReadingForm {
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly hasPrimary = input.required<boolean>();
  readonly submitted = output<VocabularyReadingUpdateRequest>();
  readonly cancelled = output<void>();
  private readonly textInput =
    viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('textInput');
  reading = '';

  isPrimary = false;
  displayOrder: number | null = null;
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;

  constructor() {
    afterNextRender(() => this.textInput()?.nativeElement.focus());
  }

  get valid(): boolean {
    return (
      validVocabularyText(this.reading, 100) &&
      validDisplayOrder(this.displayOrder) &&
      (this.hasPrimary() || this.isPrimary)
    );
  }

  submit(): void {
    if (!this.valid || this.locked() || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({
      reading: this.reading,
      isPrimary: this.isPrimary,
      displayOrder: this.displayOrder,
    });
  }
}
