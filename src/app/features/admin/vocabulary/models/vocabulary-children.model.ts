import { isRecord } from '../../../../core/api/api-response.model';

export interface VocabularyReadingUpdateRequest {
  readonly reading: string;
  readonly isPrimary: boolean;
  readonly displayOrder: number;
}
export interface VocabularyMeaningUpdateRequest {
  readonly language: 'vi' | 'en';
  readonly meaning: string;
  readonly isPrimary: boolean;
  readonly displayOrder: number;
}
export interface VocabularyReadingResult {
  readonly readingId: number;
}
export interface VocabularyMeaningResult {
  readonly meaningId: number;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function isReadingResults(value: unknown): value is readonly VocabularyReadingResult[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 100 &&
    value.every((item: unknown) => isRecord(item) && isId(item['readingId']))
  );
}
export function isMeaningResults(value: unknown): value is readonly VocabularyMeaningResult[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 100 &&
    value.every((item: unknown) => isRecord(item) && isId(item['meaningId']))
  );
}
export function validDisplayOrder(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 2147483647;
}
