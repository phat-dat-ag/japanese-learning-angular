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
import {
  CoreFieldErrors,
  validCoreText,
  VocabularyCore,
  VocabularyCoreUpdateRequest,
} from '../models/vocabulary-core.model';

@Component({
  selector: 'app-vocabulary-core-form',
  imports: [FormsModule, VocabularyFormActions],
  templateUrl: './vocabulary-core-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyCoreForm implements OnInit {
  readonly core = input.required<VocabularyCore>();
  readonly locked = input(false);
  readonly fieldErrors = input<CoreFieldErrors>({});
  readonly submitted = output<VocabularyCoreUpdateRequest>();
  readonly cancelled = output<void>();
  private readonly wordInput = viewChild<ElementRef<HTMLInputElement>>('wordInput');
  word = '';
  normalizedWord = '';
  readonly validText = validCoreText;

  constructor() {
    afterNextRender(() => this.wordInput()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.word = this.core().word;
    this.normalizedWord = this.core().normalizedWord;
  }

  get valid(): boolean {
    return validCoreText(this.word) && validCoreText(this.normalizedWord);
  }

  submit(): void {
    if (!this.valid || this.locked()) return;
    this.submitted.emit({ word: this.word, normalizedWord: this.normalizedWord });
  }
}
