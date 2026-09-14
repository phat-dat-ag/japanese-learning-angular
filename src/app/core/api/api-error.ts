import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { ApiErrorBody, ApiMeta, isApiResponse } from './api-response.model';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: ApiErrorBody['details'] = [],
    readonly meta?: ApiMeta,
  ) {
    super(message);
  }

  static invalidResponse(status: number, meta?: ApiMeta): ApiError {
    return new ApiError(
      'INVALID_RESPONSE',
      'The server returned an invalid response.',
      status,
      [],
      meta,
    );
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TimeoutError) {
    return new ApiError('REQUEST_TIMEOUT', 'The request timed out. Please try again.', 0);
  }

  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (isApiResponse(body) && !body.success) {
      return new ApiError(
        body.error.code,
        body.error.message,
        error.status,
        body.error.details,
        body.meta,
      );
    }

    return error.status === 0
      ? new ApiError('NETWORK_ERROR', 'Unable to connect to the server. Please try again.', 0)
      : new ApiError(
        'HTTP_ERROR',
        'The request could not be completed. Please try again.',
        error.status,
      );
  }

  return new ApiError('UNEXPECTED_ERROR', 'Something went wrong. Please try again.', 0);
}
