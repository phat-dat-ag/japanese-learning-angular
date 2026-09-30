import { Flashcard } from '../../../flashcard/models/flashcard.model';
import { VocabularyCore } from './vocabulary-core.model';

export type VocabularyReading = Flashcard['readings'][number];
export type VocabularyMeaning = Flashcard['meanings'][number];

export interface VocabularyDetailData extends VocabularyCore {
  readonly readings: readonly VocabularyReading[];
  readonly meanings: readonly VocabularyMeaning[];
}
