import { VocabularyFormActions } from './vocabulary-form-actions';
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
import { PartOfSpeechAssignmentAddRequest } from '../models/vocabulary-metadata.model';
import { validVocabularyText } from '../models/vocabulary-validation';

@Component({
  selector: 'app-vocabulary-part-of-speech-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-part-of-speech-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class VocabularyPartOfSpeechForm {
  readonly locked = input(false);
  readonly fieldErrors = input<AdditionErrors>({});
  readonly cancelled = output<void>();
  private readonly first = viewChild<ElementRef<HTMLInputElement | HTMLSelectElement>>('first');

  constructor() {
    afterNextRender(() => this.first()?.nativeElement.focus());
  }

  readonly submitted = output<PartOfSpeechAssignmentAddRequest>();
  code = '';

  get valid(): boolean {
    return validVocabularyText(this.code, 50);
  }

  submit(): void {
    if (this.locked() || !this.valid) return;
    this.submitted.emit({ code: this.code });
  }
}
