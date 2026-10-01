import { isRecord } from '../../../core/api/api-response.model';

export interface Flashcard {
  readonly vocabulary: {
    readonly id: number;
    readonly word: string;
    readonly normalizedWord: string;
  };
  readonly readings: readonly {
    readonly readingId: number;
    readonly displayOrder: number;
    readonly reading: string;
    readonly isPrimary: boolean;
    readonly pitchAccents: readonly number[];
    readonly pitchAccentDetails: readonly {
      readonly pitchAccentId: number;
      readonly accentPattern: number;
    }[];
  }[];
  readonly meanings: readonly {
    readonly meaningId: number;
    readonly displayOrder: number;
    readonly languageCode: string;
    readonly meaning: string;
    readonly isPrimary: boolean;
  }[];
  readonly partsOfSpeech: readonly {
    readonly code: string;
    readonly nameVi: string;
    readonly nameEn: string;
  }[];
  readonly levels: readonly {
    readonly levelId: number;
    readonly code: string;
    readonly name: string;
    readonly displayOrder: number;
  }[];
  readonly lessons: readonly {
    readonly lessonId: number;
    readonly assignmentDisplayOrder: number;
    readonly levelCode: string;
    readonly levelName: string;
    readonly lessonNumber: number;
    readonly title: string;
    readonly description: string;
    readonly displayOrder: number;
  }[];
  readonly kanji: readonly {
    readonly kanjiId: number;
    readonly displayOrder: number;
    readonly character: string;
    readonly strokeCount: number | null;
    readonly meaningVi: string | null;
    readonly meaningEn: string | null;
    readonly readings: readonly {
      readonly kanjiReadingId: number;
      readonly reading: string;
      readonly readingType: string;
      readonly displayOrder: number;
    }[];
  }[];
  readonly examples: readonly {
    readonly exampleId: number;
    readonly displayOrder: number;
    readonly japaneseText: string;
    readonly japaneseReading: string;
    readonly meaningVi: string;
    readonly meaningEn: string;
    readonly targetText: string;
  }[];
}

function hasStrings<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, string> & Record<string, unknown> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string');
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isArrayOf(value: unknown, validate: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(validate);
}

export function isFlashcard(value: unknown): value is Flashcard {
  if (!isRecord(value)) return false;
  const readingIds = new Set<number>();
  const meaningIds = new Set<number>();
  const levelIds = new Set<number>();
  const lessonIds = new Set<number>();
  const accentIds = new Set<number>();
  const kanjiIds = new Set<number>();
  const kanjiReadingIds = new Set<number>();
  const exampleIds = new Set<number>();
  const validChild = (item: Record<string, unknown>, key: string, ids: Set<number>): boolean => {
    const id = item[key];
    const order = item['displayOrder'];
    if (
      !isNonNegativeInteger(id) ||
      id === 0 ||
      ids.has(id) ||
      !isNonNegativeInteger(order) ||
      order > 2147483647
    )
      return false;
    ids.add(id);
    return true;
  };
  const vocabulary = value['vocabulary'];
  return (
    hasStrings(vocabulary, ['word', 'normalizedWord']) &&
    isNonNegativeInteger(vocabulary['id']) &&
    vocabulary['id'] > 0 &&
    vocabulary.word.trim().length > 0 &&
    isArrayOf(
      value['readings'],
      (item) =>
        hasStrings(item, ['reading']) &&
        validChild(item, 'readingId', readingIds) &&
        typeof item['isPrimary'] === 'boolean' &&
        isArrayOf(item['pitchAccents'], isNonNegativeInteger) &&
        isArrayOf(item['pitchAccentDetails'], (accent) => {
          if (!isRecord(accent)) return false;
          const id = accent['pitchAccentId'];
          const pattern = accent['accentPattern'];
          if (
            !isNonNegativeInteger(id) ||
            id === 0 ||
            accentIds.has(id) ||
            !isNonNegativeInteger(pattern) ||
            pattern > 65535
          )
            return false;
          accentIds.add(id);
          return true;
        }),
    ) &&
    isArrayOf(
      value['meanings'],
      (item) =>
        hasStrings(item, ['languageCode', 'meaning']) &&
        validChild(item, 'meaningId', meaningIds) &&
        typeof item['isPrimary'] === 'boolean',
    ) &&
    isArrayOf(value['partsOfSpeech'], (item) => hasStrings(item, ['code', 'nameVi', 'nameEn'])) &&
    isArrayOf(
      value['levels'],
      (item) => hasStrings(item, ['code', 'name']) && validChild(item, 'levelId', levelIds),
    ) &&
    isArrayOf(
      value['lessons'],
      (item) =>
        hasStrings(item, ['levelCode', 'levelName', 'title', 'description']) &&
        validChild(item, 'lessonId', lessonIds) &&
        isNonNegativeInteger(item['assignmentDisplayOrder']) &&
        item['assignmentDisplayOrder'] >= 1 &&
        item['assignmentDisplayOrder'] <= 2147483647 &&
        isNonNegativeInteger(item['lessonNumber']) &&
        item['lessonNumber'] > 0 &&
        isNonNegativeInteger(item['displayOrder']),
    ) &&
    isArrayOf(
      value['kanji'],
      (item) =>
        hasStrings(item, ['character']) &&
        validChild(item, 'kanjiId', kanjiIds) &&
        (item['meaningVi'] === null || typeof item['meaningVi'] === 'string') &&
        (item['meaningEn'] === null || typeof item['meaningEn'] === 'string') &&
        (item['strokeCount'] === null ||
          (isNonNegativeInteger(item['strokeCount']) && item['strokeCount'] <= 65535)) &&
        isArrayOf(
          item['readings'],
          (reading) =>
            hasStrings(reading, ['reading', 'readingType']) &&
            validChild(reading, 'kanjiReadingId', kanjiReadingIds),
        ),
    ) &&
    isArrayOf(
      value['examples'],
      (item) =>
        hasStrings(item, [
          'japaneseText',
          'japaneseReading',
          'meaningVi',
          'meaningEn',
          'targetText',
        ]) && validChild(item, 'exampleId', exampleIds),
    )
  );
}
