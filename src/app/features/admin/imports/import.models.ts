import { ApiErrorBody, isRecord } from '../../../core/api/api-response.model';

export type ImportKind = 'vocabulary' | 'lessons';

export interface VocabularyImportResult {
  readonly total: number;
  readonly created: number;
  readonly updated: number;
}

export type LessonBatchResult =
  | {
    readonly index: number;
    readonly success: true;
    readonly lesson: {
      readonly id: number;
      readonly lessonNumber: number;
      readonly title: string;
      readonly description?: string | null;
    };
  }
  | { readonly index: number; readonly success: false; readonly error: ApiErrorBody };

export interface LessonBatchResponse {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: readonly LessonBatchResult[];
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isVocabularyImportResult(value: unknown): value is VocabularyImportResult {
  return (
    isRecord(value) &&
    isCount(value['total']) &&
    isCount(value['created']) &&
    isCount(value['updated']) &&
    value['created'] + value['updated'] === value['total']
  );
}

function isLessonResult(value: unknown): value is LessonBatchResult {
  if (!isRecord(value) || !isCount(value['index']) || value['index'] > 99) return false;

  if (value['success'] === true) {
    const lesson = value['lesson'];
    return (
      isRecord(lesson) &&
      isCount(lesson['id']) &&
      lesson['id'] > 0 &&
      isCount(lesson['lessonNumber']) &&
      lesson['lessonNumber'] > 0 &&
      typeof lesson['title'] === 'string' &&
      (lesson['description'] == null || typeof lesson['description'] === 'string')
    );
  }

  const error = value['error'];

  return (
    value['success'] === false &&
    isRecord(error) &&
    typeof error['code'] === 'string' &&
    typeof error['message'] === 'string' &&
    Array.isArray(error['details']) &&
    error['details'].every(
      (detail: unknown) =>
        isRecord(detail) &&
        typeof detail['field'] === 'string' &&
        typeof detail['message'] === 'string',
    )
  );
}

export function isLessonBatchResponse(value: unknown): value is LessonBatchResponse {
  if (
    !isRecord(value) ||
    !isCount(value['total']) ||
    value['total'] < 1 ||
    value['total'] > 100 ||
    !isCount(value['succeeded']) ||
    !isCount(value['failed']) ||
    value['succeeded'] + value['failed'] !== value['total'] ||
    !Array.isArray(value['results'])
  )
    return false;

  const results: unknown[] = value['results'];

  return (
    results.length === value['total'] &&
    results.every(isLessonResult) &&
    results.every((result, index) => result.index === index) &&
    results.filter((result) => result.success).length === value['succeeded']
  );
}
