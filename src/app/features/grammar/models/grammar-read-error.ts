import { ApiError } from '../../../core/api/api-error';

export function grammarReadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session could not be verified. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to read these grammar lessons.';
    if (error.status === 404) return 'This lesson or JLPT level is no longer available.';
    if (error.code === 'LESSON_CONTENT_SCHEMA_UNSUPPORTED')
      return 'This lesson uses an unsupported grammar schema. Please try another lesson.';
    if (error.code === 'INVALID_RESPONSE')
      return 'The server returned invalid lesson data. Please try again later.';
  }
  return 'Unable to load grammar lessons. Check your connection and try again.';
}
