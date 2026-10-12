import {
  ChangeDetectionStrategy,
  Component,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  QuestionErrors,
  validateAnswerOptions,
  validateOptions,
} from '../models/question-form.model';
import { QuizQuestionResponse } from '../models/quiz-question.model';

@Component({
  selector: 'app-question-options',
  imports: [ReactiveFormsModule],
  templateUrl: './question-options.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionOptions implements OnChanges {
  readonly question = input.required<QuizQuestionResponse>();
  readonly locked = input(false);
  readonly textSaved = output<{ optionId: number; text: string }>();
  readonly correctSaved = output<number>();
  readonly editingId = signal<number | null>(null);
  readonly text = new FormControl('', { nonNullable: true });
  readonly correctId = new FormControl<number | null>(null);
  readonly errors = signal<QuestionErrors>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['question']) return;
    this.reset();
  }

  private reset(): void {
    this.editingId.set(null);
    this.text.reset('');
    const correct = this.question().options.filter((option) => option.correct);
    this.correctId.reset(correct.length === 1 ? correct[0].id : null);
    this.errors.set({});
  }

  dirty(): boolean {
    return this.editingId() !== null || this.correctId.dirty;
  }

  edit(optionId: number): void {
    if (this.locked() || this.question().status === 'ARCHIVED' || this.dirty()) return;
    const option = this.question().options.find((item) => item.id === optionId);
    if (!option) return;
    this.editingId.set(optionId);
    this.text.reset(option.text);
    this.errors.set({});
  }

  cancel(): void {
    if (this.locked()) return;
    this.reset();
  }

  saveText(): void {
    if (this.locked() || this.question().status === 'ARCHIVED') return;
    const optionId = this.editingId();
    if (optionId === null) return;
    const options = this.question().options;
    const errors = validateAnswerOptions(
      options.map((item) => (item.id === optionId ? { ...item, text: this.text.value } : item)),
    );
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    this.textSaved.emit({ optionId, text: this.text.value });
  }

  saveCorrect(): void {
    if (this.locked() || this.question().status === 'ARCHIVED' || this.editingId() !== null) return;
    const options = this.question().options;
    const index = options.findIndex((item) => item.id === this.correctId.value);
    const errors = validateOptions(
      options.map((item) => item.text),
      index,
    );
    this.errors.set(errors);
    const option = options[index];
    if (
      Object.keys(errors).length ||
      !option ||
      (option.correct && options.filter((item) => item.correct).length === 1)
    )
      return;
    this.correctSaved.emit(option.id);
  }
}
