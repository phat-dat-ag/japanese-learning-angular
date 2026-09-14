import { isRecord } from '../../../core/api/api-response.model';

export interface FlashcardLesson {
  readonly id: number;
  readonly lessonNumber: number;
  readonly title: string;
  readonly description: string;
}

export function isFlashcardLessons(value: unknown): value is readonly FlashcardLesson[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const ids = new Set<number>();
  return value.every((lesson: unknown) => {
    if (
      !isRecord(lesson) ||
      typeof lesson['id'] !== 'number' ||
      !Number.isSafeInteger(lesson['id']) ||
      lesson['id'] <= 0 ||
      typeof lesson['lessonNumber'] !== 'number' ||
      !Number.isSafeInteger(lesson['lessonNumber']) ||
      lesson['lessonNumber'] <= 0 ||
      typeof lesson['title'] !== 'string' ||
      lesson['title'].trim().length === 0 ||
      typeof lesson['description'] !== 'string' ||
      ids.has(lesson['id'])
    ) {
      return false;
    }
    ids.add(lesson['id']);
    return true;
  });
}
