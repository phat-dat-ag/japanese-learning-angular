import { isRecord } from '../../../../core/api/api-response.model';
import { VocabularyDetailData } from './vocabulary-detail.model';

export interface VocabularyPitchAccentUpdateRequest {
  readonly readingId: number;
  readonly accentPattern: number;
}

export interface AssignmentOrderUpdateRequest {
  readonly displayOrder: number;
}

export interface LevelAssignmentAddRequest extends AssignmentOrderUpdateRequest {
  readonly level: string;
}

export interface LessonAssignmentAddRequest extends AssignmentOrderUpdateRequest {
  readonly lessonId: number;
}

export interface PartOfSpeechAssignmentAddRequest {
  readonly code: string;
}

export type MetadataKind = 'pitch-accents' | 'levels' | 'lessons' | 'parts-of-speech';

export type MetadataSubmission =
  | { readonly kind: 'pitch-accents'; readonly request: VocabularyPitchAccentUpdateRequest }
  | { readonly kind: 'levels'; readonly request: LevelAssignmentAddRequest }
  | { readonly kind: 'lessons'; readonly request: LessonAssignmentAddRequest }
  | { readonly kind: 'parts-of-speech'; readonly request: PartOfSpeechAssignmentAddRequest };

export type MetadataUpdate =
  | { readonly kind: 'pitch-accents'; readonly items: VocabularyDetailData['pitchAccents'] }
  | { readonly kind: 'levels'; readonly items: VocabularyDetailData['levels'] }
  | { readonly kind: 'lessons'; readonly items: VocabularyDetailData['lessons'] }
  | { readonly kind: 'parts-of-speech'; readonly items: VocabularyDetailData['partsOfSpeech'] };

export type MetadataSelection =
  | { readonly kind: 'pitch-accents'; readonly item: VocabularyDetailData['pitchAccents'][number] }
  | { readonly kind: 'levels'; readonly item: VocabularyDetailData['levels'][number] }
  | { readonly kind: 'lessons'; readonly item: VocabularyDetailData['lessons'][number] };

export function identityResult<K extends string>(key: K) {
  return (value: unknown): value is Readonly<Record<K, number>> =>
    isRecord(value) &&
    typeof value[key] === 'number' &&
    Number.isSafeInteger(value[key]) &&
    value[key] > 0;
}
