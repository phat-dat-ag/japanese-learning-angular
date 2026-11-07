import { ApiError } from '../../../../core/api/api-error';
import { ApiValidationError } from '../../../../core/api/api-response.model';

export interface GrammarImportFeedback {
  readonly kind: 'rejected' | 'uncertain' | 'error';
  readonly message: string;
  readonly code?: string;
  readonly details: readonly ApiValidationError[];
}
export function grammarImportError(error: unknown): GrammarImportFeedback {
  const uncertain =
    'The import outcome could not be confirmed. Some lessons may already have been committed. Check the lesson list and current content revisions before selecting the file again. SKIP_EXISTING can skip prior successes; UPDATE_EXISTING needs fresh versions and ETags. No automatic retry was made.';
  if (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500 ||
    error.code === 'INVALID_RESPONSE'
  )
    return { kind: 'uncertain', message: uncertain, details: [] };
  if (error.status === 401 || error.status === 403)
    return {
      kind: 'error',
      message: 'An authorized Admin session is required to import grammar lessons.',
      details: [],
    };
  if ([400, 404, 409, 413, 415].includes(error.status))
    return {
      kind: 'rejected',
      message:
        error.status === 413
          ? 'The file or multipart request exceeds the deployed server limit. The browser accepts files up to 5 MiB.'
          : error.code === 'HTTP_ERROR'
            ? 'The server rejected the upload. Check the JSON format and deployed API compatibility.'
            : error.message,
      code: error.code,
      details: error.details,
    };
  return {
    kind: 'error',
    message:
      'The upload was not accepted. Check the server response and current lesson data before trying again.',
    code: error.code,
    details: [],
  };
}
