import { ApiError } from '../../../../core/api/api-error';

export type AdditionField =
  | 'reading'
  | 'meaning'
  | 'language'
  | 'isPrimary'
  | 'displayOrder'
  | 'readingId'
  | 'accentPattern'
  | 'level'
  | 'lessonId'
  | 'code'
  | 'japaneseText'
  | 'japaneseReading'
  | 'meaningVi'
  | 'meaningEn'
  | 'targetText'
  | 'character'
  | 'strokeCount'
  | 'readingType';
export type AdditionErrors = Readonly<Partial<Record<AdditionField, string>>>;
export type AdditionState =
  | { readonly status: 'idle' | 'saving' | 'refreshing' | 'saved' | 'refresh-error' }
  | { readonly status: 'error'; readonly message: string; readonly fields: AdditionErrors };

export function additionError(
  error: unknown,
  kind:
    | 'reading'
    | 'meaning'
    | 'pitch accent'
    | 'level assignment'
    | 'lesson assignment'
    | 'part of speech'
    | 'example'
    | 'kanji'
    | 'kanji reading',
  operation: 'add' | 'edit' = 'add',
): AdditionState {
  const fields: Partial<Record<AdditionField, string>> = {};
  let message =
    'Unable to ' +
    (operation === 'edit' ? 'update' : 'add') +
    ' this ' +
    kind +
    '. Please try again.';
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        message =
          kind === 'reading'
            ? 'Check the reading fields. The vocabulary must retain at least one primary reading.'
            : kind === 'lesson assignment'
              ? 'Check the assignment fields. Assign the lesson’s JLPT level to this vocabulary first.'
              : 'Check the ' + kind + ' fields and try again.';
        for (const detail of error.details) {
          if (
            (detail.field === 'reading' && (kind === 'reading' || kind === 'kanji reading')) ||
            (detail.field === 'meaning' && kind === 'meaning') ||
            detail.field === 'japaneseText' ||
            detail.field === 'japaneseReading' ||
            detail.field === 'meaningVi' ||
            detail.field === 'meaningEn' ||
            detail.field === 'targetText' ||
            detail.field === 'character' ||
            detail.field === 'strokeCount' ||
            detail.field === 'readingType' ||
            detail.field === 'readingId' ||
            detail.field === 'accentPattern' ||
            detail.field === 'level' ||
            detail.field === 'lessonId' ||
            detail.field === 'code' ||
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
        message =
          operation === 'edit'
            ? 'This ' +
            kind +
            ' or its vocabulary is no longer available. Return to Vocabulary Management.'
            : kind === 'reading' || kind === 'meaning'
              ? 'This vocabulary no longer exists. Return to Vocabulary Management.'
              : 'The vocabulary or selected master-data entry is no longer available. Check the selection and try again.';
        break;
      case 409:
        if (kind === 'example' || kind === 'kanji' || kind === 'kanji reading') {
          message =
            kind === 'example'
              ? 'This example conflicts with an existing example or shared sentence content. Shared sentence content cannot be changed here; its vocabulary target and order can still be edited. Your draft has been kept.'
              : kind === 'kanji'
                ? 'This kanji conflicts with an existing assignment or shared metadata. Attaching existing kanji requires matching metadata; shared metadata cannot be changed here, but assignment order can. Your draft has been kept.'
                : 'This reading conflicts with an existing reading or belongs to shared kanji. Readings of shared kanji cannot be added or edited here. Your draft has been kept.';
          break;
        }
        message =
          kind === 'reading'
            ? 'This reading already exists for the vocabulary.'
            : kind === 'meaning'
              ? 'This meaning already exists for the selected language.'
              : 'This ' + kind + ' already exists for the vocabulary.';
        break;
    }
  }
  return { status: 'error', message, fields };
}
