import { Flashcard } from '../../../flashcard/models/flashcard.model';

export const vocabularyMeta = {
  timestamp: '2026-09-29',
  traceId: 'trace',
  correlationId: 'correlation',
};

export function vocabularyDetailFixture(id = 42): Flashcard {
  return {
    vocabulary: { id, word: '日本語', normalizedWord: 'にほんご' },
    readings: [],
    meanings: [],
    partsOfSpeech: [],
    levels: [],
    lessons: [],
    kanji: [],
    examples: [],
  };
}
