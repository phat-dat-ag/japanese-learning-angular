import { ApiError } from '../../../../core/api/api-error';

export function grammarContentError(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Unable to complete the request. Your local draft is preserved.';
  if (error.status === 401 || error.status === 403)
    return 'An Admin session is required. Your draft is preserved; export it before signing in again.';
  if (error.status === 409)
    return 'The server content changed or its revision no longer matches. Your draft is preserved. Export it, then reload the server version before saving again.';
  if (error.code === 'LESSON_CONTENT_ETAG_MISSING')
    return 'The server did not return a valid ETag. Export your draft, then reload before saving or deleting.';
  if (error.code === 'LESSON_CONTENT_SCHEMA_UNSUPPORTED')
    return 'This document uses an unsupported schema version. Only schema version 1 can be edited.';
  if (error.status === 404)
    return error.code === 'LESSON_CONTENT_NOT_FOUND'
      ? 'The content no longer exists. Export your draft and reload before continuing.'
      : 'This lesson no longer exists. Your local draft is preserved.';
  if (error.status === 413) return 'The content is too large. Reduce it to at most 1 MiB.';
  if (error.status === 400)
    return 'The content was rejected. Review the validation details and correct the draft.';
  if (error.status === 0 || error.code === 'INVALID_RESPONSE' || error.status >= 500)
    return 'The result could not be confirmed. Your draft is preserved. Export it and reload the server version before repeating a write.';
  return 'Unable to complete the request. Your local draft is preserved.';
}
export function contentNeedsReload(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status === 404 ||
    error.status === 409 ||
    error.status >= 500 ||
    error.code === 'INVALID_RESPONSE' ||
    error.code === 'LESSON_CONTENT_ETAG_MISSING' ||
    error.code === 'LESSON_CONTENT_SCHEMA_UNSUPPORTED'
  );
}
