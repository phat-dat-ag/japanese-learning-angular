import { isRecord } from '../../../../core/api/api-response.model';

export interface VocabularyCore {
  readonly id: number;
  readonly word: string;
  readonly normalizedWord: string;
}

export interface VocabularyCoreUpdateRequest {
  readonly word: string;
  readonly normalizedWord: string;
}

export interface VocabularyCoreResult {
  readonly vocabularyId: number;
}

export type CoreField = keyof VocabularyCoreUpdateRequest;
export type CoreFieldErrors = Readonly<Partial<Record<CoreField, string>>>;

export function isVocabularyCoreResult(value: unknown): value is VocabularyCoreResult {
  return (
    isRecord(value) &&
    typeof value['vocabularyId'] === 'number' &&
    Number.isSafeInteger(value['vocabularyId']) &&
    value['vocabularyId'] > 0
  );
}

// Jakarta NotBlank uses Java whitespace, which differs from JavaScript trim (for example NBSP).
export function validCoreText(value: string): boolean {
  return (
    value.length <= 100 &&
    /[^\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/u.test(
      value,
    )
  );
}
