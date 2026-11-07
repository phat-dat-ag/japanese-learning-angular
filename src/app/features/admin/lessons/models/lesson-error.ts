import { ApiError } from '../../../../core/api/api-error';

export function lessonError(error: unknown, deleting = false): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return 'An Admin session is required. Sign in with an authorized account.';
    if (error.status === 409)
      return deleting
        ? 'This lesson is referenced by vocabulary, quizzes, flashcards, or learning history and cannot be deleted.'
        : 'The lesson number or display order is already in use in this JLPT level. Review the values and try again.';
    if (error.status === 404)
      return 'The lesson or JLPT level no longer exists. Return to the lesson list.';
    if (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE')
      return 'The request could not be confirmed. Reload the list to check before repeating a write.';
  }
  return 'Unable to complete the request. Please try again.';
}
