import { Flashcard } from '../../../flashcard/models/flashcard.model';
import { VocabularyCore } from './vocabulary-core.model';

export type VocabularyReading = Flashcard['readings'][number];
export type VocabularyMeaning = Flashcard['meanings'][number];

export type VocabularyExample = Flashcard['examples'][number];
export type VocabularyKanji = Flashcard['kanji'][number];
export type VocabularyKanjiReading = VocabularyKanji['readings'][number];

export interface VocabularyPitchAccent {
  readonly pitchAccentId: number;
  readonly readingId: number;
  readonly reading: string;
  readonly accentPattern: number;
}
export interface VocabularyDetailData extends VocabularyCore {
  readonly readings: readonly VocabularyReading[];
  readonly meanings: readonly VocabularyMeaning[];
  readonly pitchAccents: readonly VocabularyPitchAccent[];
  readonly levels: Flashcard['levels'];
  readonly lessons: Flashcard['lessons'];
  readonly partsOfSpeech: Flashcard['partsOfSpeech'];
  readonly examples: readonly VocabularyExample[];
  readonly kanji: readonly VocabularyKanji[];
}
