import { isPersonalCard, isProgress, ProgressState } from './learning.model';
import { isRecord } from '../../../core/api/api-response.model';

export interface FlashcardPage {
  readonly flashcardItems: readonly {
    readonly id: number;
    readonly word: string;
    readonly progress?: ProgressState;
    readonly bookmarked?: boolean;
  }[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isFlashcardPage(value: unknown): value is FlashcardPage {
  if (!isRecord(value) || !Array.isArray(value['flashcardItems'])) return false;
  const ids = new Set<number>();
  return (
    isNonNegativeInteger(value['page']) &&
    isNonNegativeInteger(value['size']) &&
    value['size'] > 0 &&
    isNonNegativeInteger(value['totalElements']) &&
    isNonNegativeInteger(value['totalPages']) &&
    value['flashcardItems'].length <= value['size'] &&
    value['flashcardItems'].every((item: unknown) => {
      if (
        !isRecord(item) ||
        !isNonNegativeInteger(item['id']) ||
        item['id'] === 0 ||
        typeof item['word'] !== 'string' ||
        !item['word'].trim() ||
        (item['progress'] !== undefined && !isProgress(item['progress'])) ||
        (item['bookmarked'] !== undefined && typeof item['bookmarked'] !== 'boolean') ||
        ids.has(item['id'])
      )
        return false;
      ids.add(item['id']);
      return true;
    })
  );
}

export function isPersonalFlashcardPage(value: unknown): value is FlashcardPage {
  return isFlashcardPage(value) && value.flashcardItems.every(isPersonalCard);
}
