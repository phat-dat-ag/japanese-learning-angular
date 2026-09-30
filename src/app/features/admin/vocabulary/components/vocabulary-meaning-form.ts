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
  VocabularyMeaningUpdateRequest,
} from '../models/vocabulary-children.model';
import { validVocabularyText } from '../models/vocabulary-validation';

@Component({
  selector: 'app-vocabulary-meaning-form',
  imports: [FormsModule],
  templateUrl: './vocabulary-meaning-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyMeaningForm {
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});

  readonly submitted = output<VocabularyMeaningUpdateRequest>();
  readonly cancelled = output<void>();
  private readonly textInput =
    viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('textInput');
  meaning = '';
  language: 'vi' | 'en' = 'en';
  isPrimary = false;
  displayOrder: number | null = null;
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;

  constructor() {
    afterNextRender(() => this.textInput()?.nativeElement.focus());
  }

  get valid(): boolean {
    return (
      validVocabularyText(this.meaning, 500) &&
      validDisplayOrder(this.displayOrder) &&
      (this.language === 'vi' || this.language === 'en')
    );
  }

  submit(): void {
    if (!this.valid || this.locked() || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({
      meaning: this.meaning,
      language: this.language,
      isPrimary: this.isPrimary,
      displayOrder: this.displayOrder,
    });
  }
}
