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
import { validVocabularyText } from '../models/vocabulary-validation';
import { VocabularyExample } from '../models/vocabulary-detail.model';
import { VocabularyExampleUpdateRequest } from '../models/vocabulary-content.model';
@Component({
  selector: 'app-vocabulary-example-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-example-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyExampleForm implements OnInit {
  readonly initial = input<VocabularyExample | null>(null);
  readonly idPrefix = input('example');
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly submitted = output<VocabularyExampleUpdateRequest>();
  readonly cancelled = output<void>();
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('first');
  constructor() {
    afterNextRender(() => this.first()?.nativeElement.focus());
  }

  japaneseText = '';
  japaneseReading = '';
  meaningVi = '';
  meaningEn = '';
  targetText = '';
  displayOrder: number | null = null;
  ngOnInit(): void {
    const item = this.initial();
    if (!item) return;
    this.japaneseText = item.japaneseText;
    this.japaneseReading = item.japaneseReading;
    this.meaningVi = item.meaningVi;
    this.meaningEn = item.meaningEn;
    this.targetText = item.targetText;
    this.displayOrder = item.displayOrder;
  }
  get valid(): boolean {
    return (
      [this.japaneseText, this.japaneseReading, this.meaningVi, this.meaningEn].every((value) =>
        validVocabularyText(value, 1000),
      ) &&
      validVocabularyText(this.targetText, 200) &&
      validDisplayOrder(this.displayOrder)
    );
  }
  submit(): void {
    if (this.locked() || !this.valid || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({
      japaneseText: this.japaneseText,
      japaneseReading: this.japaneseReading,
      meaningVi: this.meaningVi,
      meaningEn: this.meaningEn,
      targetText: this.targetText,
      displayOrder: this.displayOrder,
    });
  }
}
