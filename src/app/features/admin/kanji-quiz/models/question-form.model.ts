import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { QuestionSource, QuizQuestionContentRequest } from './quiz-question.model';

export function createQuestionForm() {
  return new FormGroup({
    sourceType: new FormControl<QuestionSource>('CUSTOM', { nonNullable: true }),
    exampleId: new FormControl<number | null>(null),
    vocabularyId: new FormControl<number | null>(null),
    sentenceReading: new FormControl('', { nonNullable: true }),
    targetStart: new FormControl<number | null>(0),
    targetLength: new FormControl<number | null>(null),
    targetReading: new FormControl('', { nonNullable: true }),
    explanationVi: new FormControl('', { nonNullable: true }),
    explanationEn: new FormControl('', { nonNullable: true }),
    levelIds: new FormControl('', { nonNullable: true }),
    lessonIds: new FormControl('', { nonNullable: true }),
    options: new FormArray(
      Array.from({ length: 4 }, () => new FormControl('', { nonNullable: true })),
    ),
    correctIndex: new FormControl<number | null>(null),
  });
}

export type QuestionFormValue = ReturnType<ReturnType<typeof createQuestionForm>['getRawValue']>;
export type QuestionField = keyof QuestionFormValue;
export type QuestionErrors = Partial<Record<QuestionField, string>>;

// Java String.strip/isBlank excludes nonbreaking spaces, unlike JavaScript trim.
const javaWhitespace =
  /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/gu;
const strip = (text: string) => text.replace(javaWhitespace, '');
export const positiveId = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value > 0;
const validText = (text: string, max: number, required = false) =>
  (!required || strip(text).length > 0) &&
  Array.from(text).length <= max &&
  !/[\uD800-\uDFFF]/u.test(text);
const kanaLetter = (text: string) =>
  /^\p{Letter}$/u.test(text) && /^(?:\p{Script=Hiragana}|\p{Script=Katakana})$/u.test(text);

export function parseQuestionIds(text: string): number[] | null {
  if (!text.trim()) return [];
  const parts = text.split(',').map((part) => part.trim());
  const ids = parts.map(Number);
  return parts.every((part) => /^\d+$/.test(part)) &&
    ids.every(positiveId) &&
    ids.length <= 100 &&
    new Set(ids).size === ids.length
    ? ids
    : null;
}

export function validateQuestion(
  value: QuestionFormValue,
  creating: boolean,
  exampleReading?: string,
): QuestionErrors {
  const errors: QuestionErrors = {};
  if (value.sourceType !== 'EXAMPLE' && value.sourceType !== 'CUSTOM')
    errors.sourceType = 'Choose EXAMPLE or CUSTOM.';
  if (value.sourceType === 'EXAMPLE' && !positiveId(value.exampleId))
    errors.exampleId = 'Enter a positive whole-number example ID.';
  if (value.vocabularyId !== null && !positiveId(value.vocabularyId))
    errors.vocabularyId = 'Enter a positive whole-number vocabulary ID or leave blank.';
  const sentence = value.sourceType === 'CUSTOM' ? value.sentenceReading : exampleReading;
  if (sentence !== undefined && !validText(sentence, 1000, true))
    errors.sentenceReading = 'A valid sentence reading of 1–1000 Unicode code points is required.';
  const start = value.targetStart;
  const length = value.targetLength;
  if (start === null || !Number.isSafeInteger(start) || start < 0 || start > 2147483647)
    errors.targetStart = 'Enter a zero-based whole-number position.';
  if (length === null || !Number.isSafeInteger(length) || length < 1 || length > 200)
    errors.targetLength = 'Enter a whole-number length from 1 to 200 code points.';
  const reading = Array.from(value.targetReading);
  if (
    !validText(value.targetReading, 200, true) ||
    !kanaLetter(reading[0] ?? '') ||
    !reading.every(
      (char) => kanaLetter(char) || /^[\u3099\u309A\u30FC\uFF70\uFF9E\uFF9F]$/u.test(char),
    )
  )
    errors.targetReading =
      'Use Hiragana or Katakana, starting with a kana letter (maximum 200 code points).';
  else if (reading.length !== length)
    errors.targetReading = 'Target reading must have exactly the selected code-point length.';
  if (
    !errors.targetStart &&
    !errors.targetLength &&
    start !== null &&
    length !== null &&
    sentence !== undefined
  ) {
    const points = Array.from(sentence);
    if (start + length > points.length)
      errors.targetLength = 'The target must fit within the sentence.';
    else if (points.slice(start, start + length).join('') !== value.targetReading)
      errors.targetReading = 'Target reading must exactly match the selected sentence segment.';
  }
  for (const field of ['explanationVi', 'explanationEn'] as const) {
    if (!validText(value[field], 2000))
      errors[field] = 'Use at most 2000 Unicode code points and valid Unicode.';
  }
  for (const field of ['levelIds', 'lessonIds'] as const) {
    if (parseQuestionIds(value[field]) === null)
      errors[field] = 'Enter up to 100 distinct positive IDs separated by commas, or leave blank.';
  }
  if (creating) {
    if (
      value.options.length !== 4 ||
      value.options.some((text) => !validText(text, 200, true) || text !== strip(text)) ||
      new Set(value.options.map((text) => text.normalize('NFKC'))).size !== 4
    )
      errors.options =
        'Provide four nonblank options, at most 200 code points each, without surrounding whitespace or NFKC-equivalent duplicates.';
    if (
      value.correctIndex === null ||
      !Number.isInteger(value.correctIndex) ||
      value.correctIndex < 0 ||
      value.correctIndex > 3
    )
      errors.correctIndex = 'Choose exactly one correct answer.';
  }
  return errors;
}

export function questionContent(value: QuestionFormValue): QuizQuestionContentRequest | null {
  const levelIds = parseQuestionIds(value.levelIds);
  const lessonIds = parseQuestionIds(value.lessonIds);
  if (!levelIds || !lessonIds || value.targetStart === null || value.targetLength === null)
    return null;
  const common = {
    vocabularyId: value.vocabularyId ?? undefined,
    targetStart: value.targetStart,
    targetLength: value.targetLength,
    targetReading: value.targetReading,
    explanationVi: value.explanationVi || undefined,
    explanationEn: value.explanationEn || undefined,
    levelIds,
    lessonIds,
  };
  if (value.sourceType === 'EXAMPLE')
    return positiveId(value.exampleId)
      ? { ...common, sourceType: 'EXAMPLE', exampleId: value.exampleId }
      : null;
  return { ...common, sourceType: 'CUSTOM', sentenceReading: value.sentenceReading };
}

/** Browser selection offsets are UTF-16; reject selections splitting surrogate pairs. */
export function selectedTarget(sentence: string, start: number, end: number) {
  if (
    start < 0 ||
    end <= start ||
    end > sentence.length ||
    !Number.isInteger(start) ||
    !Number.isInteger(end)
  )
    return null;
  const prefix = sentence.slice(0, start);
  const reading = sentence.slice(start, end);
  if (/[\uD800-\uDFFF]/u.test(prefix) || /[\uD800-\uDFFF]/u.test(reading)) return null;
  return {
    targetStart: Array.from(prefix).length,
    targetLength: Array.from(reading).length,
    targetReading: reading,
  };
}
