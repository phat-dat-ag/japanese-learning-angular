import { isRecord } from '../../../../core/api/api-response.model';

export interface QuizImportError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export type QuizImportItemResult =
  | {
    readonly index: number;
    readonly status: 'IMPORTED';
    readonly questionId: number;
    readonly version: number;
    readonly errors?: never;
  }
  | {
    readonly index: number;
    readonly status: 'FAILED';
    readonly errors: readonly QuizImportError[];
    readonly questionId?: never;
    readonly version?: never;
  };

export interface QuizImportResponse {
  readonly total: number;
  readonly imported: number;
  readonly failed: number;
  readonly results: readonly QuizImportItemResult[];
}

const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

function isImportError(value: unknown): value is QuizImportError {
  return (
    isRecord(value) &&
    typeof value['field'] === 'string' &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string'
  );
}

function isImportItem(value: unknown): value is QuizImportItemResult {
  if (!isRecord(value) || !integer(value['index'])) return false;
  if (value['status'] === 'IMPORTED')
    return (
      integer(value['questionId'], 1) && integer(value['version']) && value['errors'] === undefined
    );
  return (
    value['status'] === 'FAILED' &&
    value['questionId'] === undefined &&
    value['version'] === undefined &&
    Array.isArray(value['errors']) &&
    value['errors'].length > 0 &&
    value['errors'].every(isImportError)
  );
}

export function isQuizImportResponse(value: unknown): value is QuizImportResponse {
  if (
    !isRecord(value) ||
    !integer(value['total'], 1) ||
    !integer(value['imported']) ||
    !integer(value['failed']) ||
    !Array.isArray(value['results']) ||
    !value['results'].every(isImportItem)
  )
    return false;
  const results = value['results'];
  const total = value['total'];
  return (
    value['total'] === value['imported'] + value['failed'] &&
    results.length === value['total'] &&
    results.filter((item) => item.status === 'IMPORTED').length === value['imported'] &&
    results.every((item) => item.index < total) &&
    new Set(results.map((item) => item.index)).size === results.length
  );
}
