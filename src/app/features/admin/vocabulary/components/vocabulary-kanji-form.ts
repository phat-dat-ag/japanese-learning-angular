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
import { VocabularyKanji } from '../models/vocabulary-detail.model';
import { KanjiUpdateRequest } from '../models/vocabulary-content.model';
@Component({
  selector: 'app-vocabulary-kanji-form',
  imports: [FormsModule],
  templateUrl: './vocabulary-kanji-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyKanjiForm implements OnInit {
  readonly initial = input<VocabularyKanji | null>(null);
  readonly idPrefix = input('kanji');
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly submitted = output<KanjiUpdateRequest>();
  readonly cancelled = output<void>();
  readonly validText = validVocabularyText;
  readonly validOrder = validDisplayOrder;
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('first');
  constructor() {
    afterNextRender(() => this.first()?.nativeElement.focus());
  }

  character = '';
  strokeCount: number | null = null;
  meaningVi = '';
  meaningEn = '';
  meaningViUnset = true;
  meaningEnUnset = true;
  displayOrder: number | null = null;
  ngOnInit(): void {
    const item = this.initial();
    if (!item) return;
    this.character = item.character;
    this.strokeCount = item.strokeCount;
    this.meaningVi = item.meaningVi ?? '';
    this.meaningEn = item.meaningEn ?? '';
    this.meaningViUnset = item.meaningVi === null;
    this.meaningEnUnset = item.meaningEn === null;
    this.displayOrder = item.displayOrder;
  }
  get validStrokes(): boolean {
    return (
      this.strokeCount === null ||
      (Number.isInteger(this.strokeCount) && this.strokeCount >= 0 && this.strokeCount <= 65535)
    );
  }
  get valid(): boolean {
    return (
      validVocabularyText(this.character, 10) &&
      this.validStrokes &&
      (this.meaningViUnset || this.meaningVi.length <= 500) &&
      (this.meaningEnUnset || this.meaningEn.length <= 500) &&
      validDisplayOrder(this.displayOrder)
    );
  }
  submit(): void {
    if (this.locked() || !this.valid || !validDisplayOrder(this.displayOrder)) return;
    this.submitted.emit({
      character: this.character,
      strokeCount: this.strokeCount,
      meaningVi: this.meaningViUnset ? null : this.meaningVi,
      meaningEn: this.meaningEnUnset ? null : this.meaningEn,
      displayOrder: this.displayOrder,
    });
  }
}
