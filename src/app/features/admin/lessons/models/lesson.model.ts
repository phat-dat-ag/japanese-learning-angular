import { isRecord } from '../../../../core/api/api-response.model';

export const LESSON_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type LessonLevelCode = (typeof LESSON_LEVELS)[number];
export interface LessonLevel {
  readonly id: number;
  readonly code: LessonLevelCode;
  readonly name: string;
}
export interface LessonWriteRequest {
  readonly levelId: number;
  readonly lessonNumber: number;
  readonly title: string;
  readonly description: string | null;
  readonly displayOrder: number;
}
export interface LessonMetadata extends LessonWriteRequest {
  readonly id: number;
}
export type LessonDraft = {
  -readonly [K in keyof LessonWriteRequest]: LessonWriteRequest[K] | null;
};
export type LessonFieldErrors = Partial<Record<keyof LessonWriteRequest, string>>;
export const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function validateLesson(value: LessonDraft): LessonFieldErrors {
  const errors = validateLessonMetadataFields(value);
  if (!positiveInteger(value.levelId)) errors.levelId = 'Choose a valid JLPT level.';
  return errors;
}
export function validateLessonMetadataFields(
  value: Pick<LessonDraft, 'lessonNumber' | 'title' | 'description' | 'displayOrder'>,
): LessonFieldErrors {
  const errors: LessonFieldErrors = {};
  for (const field of ['lessonNumber', 'displayOrder'] as const) {
    if (!positiveInteger(value[field]) || value[field] > 2147483647)
      errors[field] = 'Enter a positive integer within the supported range.';
  }
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200)
    errors.title = 'Enter a nonblank title of at most 200 characters.';
  if (
    value.description !== null &&
    (typeof value.description !== 'string' || value.description.length > 1000)
  )
    errors.description = 'Description must be at most 1,000 characters.';
  return errors;
}

export function isLessonMetadata(value: unknown): value is LessonMetadata {
  if (!isRecord(value) || !positiveInteger(value['id'])) return false;
  return (
    Object.keys(
      validateLesson({
        levelId: value['levelId'] as number,
        lessonNumber: value['lessonNumber'] as number,
        title: value['title'] as string,
        description: value['description'] as string | null,
        displayOrder: value['displayOrder'] as number,
      }),
    ).length === 0
  );
}
export function isLessonList(value: unknown): value is readonly LessonMetadata[] {
  return (
    Array.isArray(value) &&
    value.every(isLessonMetadata) &&
    new Set(value.map((lesson) => lesson.id)).size === value.length
  );
}
export function isLessonLevels(value: unknown): value is readonly LessonLevel[] {
  return (
    Array.isArray(value) &&
    value.every(
      (level: unknown) =>
        isRecord(level) &&
        positiveInteger(level['id']) &&
        LESSON_LEVELS.some((code) => code === level['code']) &&
        typeof level['name'] === 'string' &&
        !!level['name'].trim(),
    ) &&
    new Set(value.map((level) => level.id)).size === value.length &&
    new Set(value.map((level) => level.code)).size === value.length
  );
}
