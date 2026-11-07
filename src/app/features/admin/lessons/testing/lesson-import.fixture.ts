import { GrammarImportItem, GrammarImportResponse } from '../models/lesson-import.model';
import { grammarDocumentFixture } from './grammar-content.fixture';

export function grammarImportItemFixture(): GrammarImportItem {
  return {
    level: 'N5',
    lessonNumber: 90001,
    title: 'Trợ từ は',
    description: null,
    displayOrder: 90001,
    schemaVersion: 1,
    expectedVersion: 0,
    content: grammarDocumentFixture(),
  };
}
export function grammarImportReportFixture(): GrammarImportResponse {
  return {
    total: 4,
    created: 1,
    updated: 1,
    skipped: 1,
    failed: 1,
    results: [
      { index: 0, level: 'N5', lessonNumber: 90001, status: 'CREATED', lessonId: 9 },
      { index: 1, level: 'N5', lessonNumber: 90002, status: 'UPDATED', lessonId: 10 },
      { index: 2, level: 'N5', lessonNumber: 90003, status: 'SKIPPED', lessonId: 11 },
      {
        index: 3,
        level: 'N5',
        lessonNumber: 90004,
        status: 'FAILED',
        lessonId: null,
        error: {
          code: 'LESSON_CONTENT_CONFLICT',
          message: 'Content revision does not match.',
          details: [{ field: 'expectedVersion', message: 'Read the current content revision.' }],
        },
      },
    ],
  };
}
