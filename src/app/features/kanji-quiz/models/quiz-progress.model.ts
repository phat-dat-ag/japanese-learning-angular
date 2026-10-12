import { isRecord } from '../../../core/api/api-response.model';

export interface QuizProgressCounts {
  readonly completedSessions: number;
  readonly answeredCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly accuracyPercentage: number;
}

export interface QuizProgress extends QuizProgressCounts {
  readonly bestScore: number;
  readonly averageScore: number;
  /** Quarkus omits null fields; OpenAPI also permits explicit null. */
  readonly latestCompletedAt?: string | null;
}

export interface QuizProgressBucket extends QuizProgressCounts {
  readonly classification: 'ASSIGNED' | 'UNASSIGNED' | 'UNKNOWN';
  readonly levelId?: number | null;
  readonly lessonId?: number | null;
}

export interface QuizProgressBreakdown {
  readonly levels: readonly QuizProgressBucket[];
  readonly lessons: readonly QuizProgressBucket[];
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function counts(value: Record<string, unknown>): boolean {
  return (
    integer(value['completedSessions']) &&
    integer(value['answeredCount']) &&
    integer(value['correctCount']) &&
    integer(value['incorrectCount']) &&
    nonnegative(value['accuracyPercentage']) &&
    value['accuracyPercentage'] <= 100
  );
}

export function isQuizProgress(value: unknown): value is QuizProgress {
  return (
    isRecord(value) &&
    counts(value) &&
    integer(value['bestScore']) &&
    nonnegative(value['averageScore']) &&
    (value['latestCompletedAt'] == null || typeof value['latestCompletedAt'] === 'string')
  );
}

function isBucket(value: unknown, dimension: 'levels' | 'lessons'): value is QuizProgressBucket {
  if (!isRecord(value) || !counts(value)) return false;
  if (value['classification'] === 'ASSIGNED') {
    return (
      integer(value['levelId'], 1) &&
      (dimension === 'levels' ? value['lessonId'] == null : integer(value['lessonId'], 1))
    );
  }
  return (
    (value['classification'] === 'UNKNOWN' || value['classification'] === 'UNASSIGNED') &&
    value['levelId'] == null &&
    value['lessonId'] == null
  );
}

export function isQuizProgressBreakdown(value: unknown): value is QuizProgressBreakdown {
  return (
    isRecord(value) &&
    Array.isArray(value['levels']) &&
    Array.isArray(value['lessons']) &&
    value['levels'].every((bucket: unknown) => isBucket(bucket, 'levels')) &&
    value['lessons'].every((bucket: unknown) => isBucket(bucket, 'lessons'))
  );
}
