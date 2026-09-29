import { FlashcardListQuery } from '../../../flashcard/models/flashcard-list-query.model';

export type VocabularyQuery = FlashcardListQuery;

export interface VocabularyPage {
  readonly items: readonly { readonly id: number; readonly word: string }[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly data: T }
  | { readonly status: 'error' };
