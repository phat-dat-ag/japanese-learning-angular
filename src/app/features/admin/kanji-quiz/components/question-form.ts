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
import { VocabularyExample } from '../../vocabulary/models/vocabulary-detail.model';
import { QuizQuestionCreateRequest, QuizQuestionResponse } from '../models/quiz-question.model';
import {
  createQuestionForm,
  positiveId,
  QuestionErrors,
  QuestionField,
  questionContent,
  selectedTarget,
  validateQuestion,
} from '../models/question-form.model';
import { QuestionTargetSelector } from './question-target-selector';

@Component({
  selector: 'app-question-form',
  imports: [ReactiveFormsModule, QuestionTargetSelector],
  templateUrl: './question-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionForm implements OnChanges {
  readonly initial = input<QuizQuestionResponse | null>(null);
  readonly locked = input(false);
  readonly backendErrors = input<QuestionErrors>({});
  readonly examples = input<readonly VocabularyExample[]>([]);
  readonly lookupLoading = input(false);
  readonly lookupMessage = input('');
  readonly lookupRequested = output<number | null>();
  readonly submitted = output<QuizQuestionCreateRequest>();
  readonly form = createQuestionForm();
  readonly lookupId = new FormControl<number | null>(null);
  readonly attempted = signal(false);
  private readonly chosenExample = signal<VocabularyExample | null>(null);
  readonly numericFields = [
    { key: 'vocabularyId', label: 'Vocabulary ID (optional)', min: 1 },
    { key: 'targetStart', label: 'Target start (zero-based)', min: 0 },
    { key: 'targetLength', label: 'Target length (code points)', min: 1 },
  ] as const;
  readonly textFields = [
    { key: 'targetReading', label: 'Target reading (exact kana segment)' },
    { key: 'levelIds', label: 'JLPT level IDs (comma-separated, optional)' },
    { key: 'lessonIds', label: 'Lesson IDs (comma-separated, optional)' },
  ] as const;
  readonly explanationFields = [
    { key: 'explanationVi', label: 'Vietnamese explanation (optional)' },
    { key: 'explanationEn', label: 'English explanation (optional)' },
  ] as const;

  constructor() {
    this.form.setValidators(() => {
      const errors = validateQuestion(
        this.form.getRawValue(),
        !this.initial(),
        this.exampleReading(),
      );
      return Object.keys(errors).length ? { question: errors } : null;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['initial']) return;
    const item = this.initial();
    this.chosenExample.set(null);
    this.attempted.set(false);
    this.form.reset({
      sourceType: item?.sourceType ?? 'CUSTOM',
      exampleId: item?.exampleId ?? null,
      vocabularyId: item?.vocabularyId ?? null,
      sentenceReading: item?.sourceType === 'CUSTOM' ? (item.sentenceReading ?? '') : '',
      targetStart: item?.targetStart ?? 0,
      targetLength: item?.targetLength ?? null,
      targetReading: item?.targetReading ?? '',
      explanationVi: item?.explanationVi ?? '',
      explanationEn: item?.explanationEn ?? '',
      levelIds: item?.levelIds.join(', ') ?? '',
      lessonIds: item?.lessonIds.join(', ') ?? '',
      options: ['', '', '', ''],
      correctIndex: null,
    });
    if (item) this.form.controls.sourceType.disable();
    else this.form.controls.sourceType.enable();
    this.form.markAsPristine();
  }

  exampleReading(): string | undefined {
    const id = this.form.controls.exampleId.value;
    const chosen = this.chosenExample();
    if (chosen?.exampleId === id) return chosen.japaneseReading;
    const initial = this.initial();
    return initial?.sourceType === 'EXAMPLE' && initial.exampleId === id
      ? initial.sentenceReading
      : undefined;
  }

  sentence(): string | undefined {
    return this.form.controls.sourceType.value === 'CUSTOM'
      ? this.form.controls.sentenceReading.value
      : this.exampleReading();
  }

  error(field: QuestionField): string {
    if (this.backendErrors()[field]) return this.backendErrors()[field] ?? '';
    if (!this.attempted() && !this.form.controls[field].touched) return '';
    return (
      validateQuestion(this.form.getRawValue(), !this.initial(), this.exampleReading())[field] ?? ''
    );
  }

  validLookup(): boolean {
    return positiveId(this.lookupId.value);
  }

  loadExamples(): void {
    if (!this.locked() && positiveId(this.lookupId.value))
      this.lookupRequested.emit(this.lookupId.value);
  }

  chooseExample(value: string): void {
    const example = this.examples().find((item) => item.exampleId === Number(value));
    if (!example || this.locked()) return;
    this.chosenExample.set(example);
    this.form.controls.exampleId.setValue(example.exampleId);
    this.form.markAsDirty();
    this.form.updateValueAndValidity();
  }

  selectTarget(target: NonNullable<ReturnType<typeof selectedTarget>>): void {
    if (this.locked()) return;
    this.form.patchValue(target);
    this.form.markAsDirty();
  }

  submit(): void {
    if (this.locked()) return;
    this.attempted.set(true);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const content = questionContent(value);
    if (!content) return;
    this.submitted.emit({
      content,
      options: value.options.map((text, index) => ({
        text,
        correct: index === value.correctIndex,
      })),
    });
  }
}
