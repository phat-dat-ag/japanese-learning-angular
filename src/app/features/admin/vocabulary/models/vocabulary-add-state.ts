import { ApiError } from '../../../../core/api/api-error';

export type AdditionField = 'reading' | 'meaning' | 'language' | 'isPrimary' | 'displayOrder';
export type AdditionErrors = Readonly<Partial<Record<AdditionField, string>>>;
export type AdditionState =
  | { readonly status: 'idle' | 'saving' | 'refreshing' | 'saved' | 'refresh-error' }
  | { readonly status: 'error'; readonly message: string; readonly fields: AdditionErrors };

export function additionError(error: unknown, kind: 'reading' | 'meaning'): AdditionState {
  const fields: Partial<Record<AdditionField, string>> = {};
  let message = 'Unable to add this ' + kind + '. Please try again.';
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        message =
          kind === 'reading'
            ? 'Check the reading fields. The vocabulary must retain at least one primary reading.'
            : 'Check the meaning fields and try again.';
        for (const detail of error.details) {
          if (
            detail.field === kind ||
            detail.field === 'isPrimary' ||
            detail.field === 'displayOrder' ||
            (kind === 'meaning' && detail.field === 'language')
          ) {
            fields[detail.field] = 'The server rejected this value. Please check it.';
          }
        }
        break;
      case 401:
        message = 'Your session could not be verified. Please sign in again.';
        break;
      case 403:
        message = 'You do not have permission to update this vocabulary.';
        break;
      case 404:
        message = 'This vocabulary no longer exists. Return to Vocabulary Management.';
        break;
      case 409:
        message =
          kind === 'reading'
            ? 'This reading already exists for the vocabulary.'
            : 'This meaning already exists for the selected language.';
        break;
    }
  }
  return { status: 'error', message, fields };
}
