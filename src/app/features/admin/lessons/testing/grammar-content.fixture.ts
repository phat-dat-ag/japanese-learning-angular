import {
  GrammarDocument,
  GrammarInlines,
  LessonContentResponse,
} from '../models/grammar-content.model';

export const grammarMeta = {
  timestamp: '2026-11-06',
  traceId: 'trace',
  correlationId: 'correlation',
};
export const grammarLesson = {
  id: 9,
  levelId: 72,
  lessonNumber: 3,
  title: 'Trợ từ は',
  description: null,
  displayOrder: 20,
};
export const grammarEtag = '"9:2026-11-06T01:00:00.123456:2"';
export const grammarInlines: GrammarInlines = [
  { text: '日本語 𠮷 — Tiếng Việt', marks: ['bold', 'italic', 'underline'] },
];
export function grammarDocumentFixture(): GrammarDocument {
  return {
    blocks: [
      { id: 'h', type: 'heading', level: 2, inlines: grammarInlines },
      { id: 'p', type: 'paragraph', inlines: grammarInlines },
      { id: 'l', type: 'list', ordered: true, items: [grammarInlines] },
      { id: 't', type: 'table', headers: [grammarInlines], rows: [[grammarInlines]] },
      {
        id: 'e',
        type: 'example',
        japanese: '私は学生です。𠮷',
        reading: 'わたしはがくせいです。',
        translations: { en: 'I am a student.', vi: 'Tôi là học sinh.' },
      },
      { id: 'c', type: 'callout', variant: 'tip', inlines: grammarInlines },
      { id: 'q', type: 'quote', inlines: grammarInlines },
      { id: 'd', type: 'divider' },
    ],
  };
}
export function grammarResponseFixture(
  version = 2,
  content = grammarDocumentFixture(),
): LessonContentResponse {
  return {
    lessonId: 9,
    schemaVersion: 1,
    version,
    content,
    createdAt: '2026-11-06T01:00:00.123456',
    updatedAt: '2026-11-06T02:00:00.123456',
  };
}
export const grammarOk = (data: unknown) => ({ success: true, data, meta: grammarMeta });
