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
import { VocabularyKanjiReading } from '../models/vocabulary-detail.model';
import { KanjiReadingUpdateRequest } from '../models/vocabulary-content.model';

@Component({
  selector: 'app-vocabulary-kanji-reading-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-kanji-reading-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyKanjiReadingForm implements OnInit {
  readonly initial = input<VocabularyKanjiReading | null>(null);
  readonly idPrefix = input('kanji-reading');
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly submitted = output<KanjiReadingUpdateRequest>();
  readonly cancelled = output<void>();
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('first');

  constructor() {
    afterNextRender(() => this.first()?.nativeElement.focus());
  }

  reading = '';
  readingType = '';
  displayOrder: number | null = null;

  ngOnInit(): void {
    const item = this.initial();
    if (!item) return;
    this.reading = item.reading;
    this.readingType = item.readingType;
    this.displayOrder = item.displayOrder;
  }

  get valid(): boolean {
    return (
      validVocabularyText(this.reading, 100) &&
      validVocabularyText(this.readingType, 20) &&
      validDisplayOrder(this.displayOrder)
    );
  }

  submit(): void {
    if (this.locked() || !this.valid || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({
      reading: this.reading,
      readingType: this.readingType,
      displayOrder: this.displayOrder,
    });
  }
}
