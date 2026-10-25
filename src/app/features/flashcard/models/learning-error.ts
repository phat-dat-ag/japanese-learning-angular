import { ApiError } from '../../../core/api/api-error';

export function learningError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'FLASHCARD_NOT_DUE')
      return 'This vocabulary is no longer due. Return later, or abandon this session and start a separate practice session.';
    if (error.code === 'FLASHCARD_CONFLICT')
      return 'Learning state changed. Refresh the session before choosing another rating.';
    if (error.status === 401) return 'Please sign in again to continue your saved session.';
    if (error.status === 403) return 'This information is unavailable to your account.';
    if (error.status === 404) return 'This session or vocabulary is unavailable.';
    if (error.status === 400) return 'Check the selected lesson and session settings.';
  }
  return 'Unable to confirm the request. Check your connection and try again.';
}

export function uncertainWrite(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500 ||
    error.code === 'INVALID_RESPONSE'
  );
}
