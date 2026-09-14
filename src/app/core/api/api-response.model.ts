export interface ApiMeta {
  readonly timestamp: string;
  readonly traceId: string;
  readonly correlationId: string;
}

export interface ApiValidationError {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details: readonly ApiValidationError[];
}

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: ApiMeta;
}

export interface ApiFailure {
  readonly success: false;
  readonly error: ApiErrorBody;
  readonly meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiMeta(value: unknown): value is ApiMeta {
  return (
    isRecord(value) &&
    typeof value['timestamp'] === 'string' &&
    typeof value['traceId'] === 'string' &&
    typeof value['correlationId'] === 'string'
  );
}

function isValidationError(value: unknown): value is ApiValidationError {
  return (
    isRecord(value) && typeof value['field'] === 'string' && typeof value['message'] === 'string'
  );
}

// HTTP JSON is untrusted at runtime, even when HttpClient has a generic type.
export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!isRecord(value) || !isApiMeta(value['meta'])) {
    return false;
  }

  if (value['success'] === true) {
    return 'data' in value;
  }

  const error = value['error'];
  return (
    value['success'] === false &&
    isRecord(error) &&
    typeof error['code'] === 'string' &&
    typeof error['message'] === 'string' &&
    Array.isArray(error['details']) &&
    error['details'].every(isValidationError)
  );
}
