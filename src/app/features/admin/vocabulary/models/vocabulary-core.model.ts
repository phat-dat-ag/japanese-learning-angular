import { validVocabularyText } from './vocabulary-validation';
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

export function validCoreText(value: string): boolean {
  return validVocabularyText(value, 100);
}
