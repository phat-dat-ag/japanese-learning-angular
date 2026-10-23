import { isFlashcard } from './flashcard.model';

const detail = {
  vocabulary: { id: 1, word: 'Word', normalizedWord: 'Word' },
  readings: [],
  meanings: [],
  partsOfSpeech: [],
  levels: [],
  lessons: [],
  kanji: [],
  examples: [],
};

// Read contracts in openapi.yaml allow persisted SQL int32 orders, including legacy values.
describe('Flashcard detail read contract used by Quiz example lookup', () => {
  it.each([-2147483648, -1, 0, 2147483647])(
    'accepts persisted order %s without applying write rules',
    (displayOrder) => {
      expect(
        isFlashcard({
          ...detail,
          readings: [
            {
              readingId: 1,
              reading: 'reading',
              isPrimary: true,
              displayOrder,
              pitchAccents: [],
              pitchAccentDetails: [],
            },
          ],
          meanings: [
            { meaningId: 2, languageCode: 'en', meaning: 'meaning', isPrimary: true, displayOrder },
          ],
          levels: [{ levelId: 3, code: 'N5', name: 'Beginner', displayOrder }],
          lessons: [
            {
              lessonId: 4,
              levelCode: 'N5',
              levelName: 'Beginner',
              lessonNumber: 1,
              title: 'Lesson',
              displayOrder,
              assignmentDisplayOrder: displayOrder,
            },
          ],
          examples: [
            {
              exampleId: 5,
              japaneseText: 'text',
              japaneseReading: 'reading',
              meaningVi: 'vi',
              meaningEn: 'en',
              targetText: 'target',
              displayOrder,
            },
          ],
          kanji: [
            {
              kanjiId: 6,
              character: 'A',
              displayOrder,
              readings: [
                { kanjiReadingId: 7, reading: 'reading', readingType: 'ON', displayOrder },
              ],
            },
          ],
        }),
      ).toBe(true);
    },
  );

  it.each([undefined, null, -2147483649, 2147483648, 0.5, '0'])(
    'rejects invalid required orders %s',
    (displayOrder) => {
      expect(
        isFlashcard({
          ...detail,
          kanji: [{ kanjiId: 1, character: 'A', displayOrder, readings: [] }],
        }),
      ).toBe(false);
    },
  );

  it.each([{ strokeCount: '6' }, { meaningVi: false }, { meaningEn: [] }, { kanjiId: 0 }])(
    'rejects malformed optional metadata or IDs %j',
    (patch) => {
      expect(
        isFlashcard({
          ...detail,
          kanji: [{ kanjiId: 1, character: 'A', displayOrder: 0, readings: [], ...patch }],
        }),
      ).toBe(false);
    },
  );
});
