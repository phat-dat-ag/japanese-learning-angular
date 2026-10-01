import { VocabularyFormActions } from './vocabulary-form-actions';
import { VocabularyMeaning } from '../models/vocabulary-detail.model';
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
import {
  validDisplayOrder,
  VocabularyMeaningUpdateRequest,
} from '../models/vocabulary-children.model';
import { validVocabularyText } from '../models/vocabulary-validation';

@Component({
  selector: 'app-vocabulary-meaning-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-meaning-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyMeaningForm implements OnInit {
  readonly initial = input<VocabularyMeaning | null>(null);
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});

  readonly submitted = output<VocabularyMeaningUpdateRequest>();
  readonly cancelled = output<void>();
  private readonly textInput =
    viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('textInput');
  meaning = '';
  language = 'en';
  isPrimary = false;
  displayOrder: number | null = null;
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;

  constructor() {
    afterNextRender(() => this.textInput()?.nativeElement.focus());
  }

  ngOnInit(): void {
    const initial = this.initial();
    if (!initial) return;
    this.meaning = initial.meaning;
    this.language = initial.languageCode;
    this.isPrimary = initial.isPrimary;
    this.displayOrder = initial.displayOrder;
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
    if (this.language !== 'vi' && this.language !== 'en') return;
    this.submitted.emit({
      meaning: this.meaning,
      language: this.language,
      isPrimary: this.isPrimary,
      displayOrder: this.displayOrder,
    });
  }
}
