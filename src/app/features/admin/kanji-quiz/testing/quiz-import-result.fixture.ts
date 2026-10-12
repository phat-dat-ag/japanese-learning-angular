import { QuizImportItemResult, QuizImportResponse } from '../models/quiz-import.model';

export const importMeta = {
  timestamp: '2026-10-11',
  traceId: 'import-trace',
  correlationId: 'import-correlation',
};

export function importResultFixture(
  statuses: readonly ('IMPORTED' | 'FAILED')[] = ['IMPORTED'],
): QuizImportResponse {
  const results = statuses.map((status, index): QuizImportItemResult =>
    status === 'IMPORTED'
      ? { index, status, questionId: 100 + index, version: index }
      : {
        index,
        status,
        errors: [
          {
            field: '[' + index + '].content.exampleId',
            code: 'QUIZ_REFERENCE_NOT_FOUND',
            message: 'Example not found',
          },
        ],
      },
  );
  const imported = statuses.filter((status) => status === 'IMPORTED').length;
  return { total: statuses.length, imported, failed: statuses.length - imported, results };
}
