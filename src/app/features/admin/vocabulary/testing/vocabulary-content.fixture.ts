import { Flashcard } from '../../../flashcard/models/flashcard.model';
import { vocabularyDetailFixture } from './vocabulary-detail.fixture';
export const contentDetail: Flashcard = {
  ...vocabularyDetailFixture(73),
  examples: [
    {
      exampleId: 691,
      japaneseText: 'First sentence',
      japaneseReading: 'first reading',
      meaningVi: 'first vi',
      meaningEn: 'first en',
      targetText: 'First',
      displayOrder: 37,
    },
    {
      exampleId: 845,
      japaneseText: 'Second sentence',
      japaneseReading: 'second reading',
      meaningVi: 'second vi',
      meaningEn: 'second en',
      targetText: 'Second',
      displayOrder: 62,
    },
  ],
  kanji: [
    {
      kanjiId: 781,
      character: 'A',
      strokeCount: 6,
      meaningVi: 'first meaning',
      meaningEn: 'first kanji',
      displayOrder: 45,
      readings: [
        { kanjiReadingId: 812, reading: 'same reading', readingType: 'ON', displayOrder: 29 },
        { kanjiReadingId: 925, reading: 'first other', readingType: 'KUN', displayOrder: 63 },
      ],
    },
    {
      kanjiId: 963,
      character: 'B',
      strokeCount: null,
      meaningVi: '',
      meaningEn: null,
      displayOrder: 81,
      readings: [
        { kanjiReadingId: 1071, reading: 'same reading', readingType: 'ON', displayOrder: 18 },
        { kanjiReadingId: 1198, reading: 'second other', readingType: 'CUSTOM', displayOrder: 74 },
      ],
    },
  ],
};
