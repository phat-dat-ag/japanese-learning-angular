import { ApiError } from '../../../core/api/api-error';

export type QuizReportState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly data: T }
  | QuizReportError;

export interface QuizReportError {
  readonly status: 'error';
  readonly message: string;
  readonly retryable: boolean;
}

export function quizReportError(error: unknown): QuizReportError {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return {
        status: 'error',
        message: 'Your sign-in has expired. Please sign in again.',
        retryable: false,
      };
    if (error.status === 403)
      return {
        status: 'error',
        message: 'This information is unavailable to your account.',
        retryable: false,
      };
    if (error.status === 404)
      return {
        status: 'error',
        message: 'This information is unavailable.',
        retryable: false,
      };
  }
  return {
    status: 'error',
    message: 'Unable to load this information. Please retry.',
    retryable: true,
  };
}
