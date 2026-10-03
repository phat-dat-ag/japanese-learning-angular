import { ApiError } from '../../../../core/api/api-error';

export function vocabularyLoadError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Your session could not be verified. Please sign in again.';
    if (error.status === 403)
      return 'You do not have permission to view this vocabulary data.';
  }

  return fallback;
}
