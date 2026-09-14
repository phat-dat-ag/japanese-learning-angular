import { isRecord } from '../../../core/api/api-response.model';

export interface Flashcard {
  readonly vocabulary: {
    readonly id: number;
    readonly word: string;
    readonly normalizedWord: string;
  };
  readonly readings: readonly {
    readonly reading: string;
    readonly isPrimary: boolean;
    readonly pitchAccents: readonly number[];
  }[];
  readonly meanings: readonly {
    readonly languageCode: string;
    readonly meaning: string;
    readonly isPrimary: boolean;
  }[];
  readonly partsOfSpeech: readonly {
    readonly code: string;
    readonly nameVi: string;
    readonly nameEn: string;
  }[];
  readonly levels: readonly { readonly code: string; readonly name: string }[];
  readonly lessons: readonly {
    readonly levelCode: string;
    readonly levelName: string;
    readonly lessonNumber: number;
    readonly title: string;
    readonly description: string;
    readonly displayOrder: number;
  }[];
  readonly kanji: readonly {
    readonly character: string;
    readonly strokeCount: number;
    readonly meaningVi: string;
    readonly meaningEn: string;
    readonly readings: readonly { readonly reading: string; readonly readingType: string }[];
  }[];
  readonly examples: readonly {
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
        typeof item['isPrimary'] === 'boolean' &&
        isArrayOf(item['pitchAccents'], isNonNegativeInteger),
    ) &&
    isArrayOf(
      value['meanings'],
      (item) =>
        hasStrings(item, ['languageCode', 'meaning']) && typeof item['isPrimary'] === 'boolean',
    ) &&
    isArrayOf(value['partsOfSpeech'], (item) => hasStrings(item, ['code', 'nameVi', 'nameEn'])) &&
    isArrayOf(value['levels'], (item) => hasStrings(item, ['code', 'name'])) &&
    isArrayOf(
      value['lessons'],
      (item) =>
        hasStrings(item, ['levelCode', 'levelName', 'title', 'description']) &&
        isNonNegativeInteger(item['lessonNumber']) &&
        item['lessonNumber'] > 0 &&
        isNonNegativeInteger(item['displayOrder']),
    ) &&
    isArrayOf(
      value['kanji'],
      (item) =>
        hasStrings(item, ['character', 'meaningVi', 'meaningEn']) &&
        isNonNegativeInteger(item['strokeCount']) &&
        isArrayOf(item['readings'], (reading) => hasStrings(reading, ['reading', 'readingType'])),
    ) &&
    isArrayOf(value['examples'], (item) =>
      hasStrings(item, ['japaneseText', 'japaneseReading', 'meaningVi', 'meaningEn', 'targetText']),
    )
  );
}
