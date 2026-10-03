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
import { VocabularyDetailData, VocabularyPitchAccent } from '../models/vocabulary-detail.model';
import { VocabularyPitchAccentUpdateRequest } from '../models/vocabulary-metadata.model';

@Component({
  selector: 'app-vocabulary-pitch-accent-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-pitch-accent-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyPitchAccentForm implements OnInit {
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly cancelled = output<void>();
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLSelectElement>>('first');

  constructor() {
    afterNextRender(() => this.first()?.nativeElement.focus());
  }

  readonly initial = input<VocabularyPitchAccent | null>(null);
  readonly readings = input.required<VocabularyDetailData['readings']>();
  readonly submitted = output<VocabularyPitchAccentUpdateRequest>();
  readingId: number | null = null;
  accentPattern: number | null = null;

  ngOnInit(): void {
    const item = this.initial();
    if (item) {
      this.readingId = item.readingId;
      this.accentPattern = item.accentPattern;
    }
  }

  get validPattern(): boolean {
    return (
      this.accentPattern !== null &&
      Number.isInteger(this.accentPattern) &&
      this.accentPattern >= 0 &&
      this.accentPattern <= 65535
    );
  }

  get validReading(): boolean {
    return this.readings().some((item) => item.readingId === this.readingId);
  }

  get valid(): boolean {
    return this.validPattern && this.validReading;
  }

  submit(): void {
    if (this.locked() || !this.valid || this.readingId === null || this.accentPattern === null)
      return;
    this.submitted.emit({ readingId: this.readingId, accentPattern: this.accentPattern });
  }
}
