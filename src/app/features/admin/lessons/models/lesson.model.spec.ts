import { isLessonLevels, isLessonList, isLessonMetadata, validateLesson } from './lesson.model';
import { isGrammarDocument, isLessonContentResponse } from './grammar-content.model';

const lesson = {
  id: 9,
  levelId: 72,
  lessonNumber: 3,
  title: '助詞',
  description: null,
  displayOrder: 20,
};
describe('Admin lesson contracts', () => {
  it('requires actual level IDs and rejects duplicate codes and IDs', () => {
    expect(isLessonLevels([{ id: 72, code: 'N5', name: 'N5' }])).toBe(true);
    expect(isLessonLevels([{ code: 'N5', name: 'N5' }])).toBe(false);
    expect(
      isLessonLevels([
        { id: 72, code: 'N5', name: 'N5' },
        { id: 72, code: 'N4', name: 'N4' },
      ]),
    ).toBe(false);
  });
  it('requires persisted metadata fields without inferring order', () => {
    expect(isLessonMetadata(lesson)).toBe(true);
    expect(isLessonMetadata({ ...lesson, displayOrder: undefined })).toBe(false);
    expect(isLessonMetadata({ ...lesson, levelId: '72' })).toBe(false);
    expect(isLessonList([lesson, lesson])).toBe(false);
  });
  it('validates required, nonblank, length, and positive integer fields', () => {
    expect(validateLesson(lesson)).toEqual({});
    expect(
      Object.keys(
        validateLesson({
          ...lesson,
          levelId: 0,
          lessonNumber: 1.5,
          displayOrder: -1,
          title: ' ',
          description: 'x'.repeat(1001),
        }),
      ),
    ).toHaveLength(5);
    expect(
      validateLesson({ ...lesson, title: 'x'.repeat(200), description: 'x'.repeat(1000) }),
    ).toEqual({});
    expect(validateLesson({ ...lesson, title: 'x'.repeat(201) }).title).toBeTruthy();
  });
});
describe('Grammar v1 contracts for later phases', () => {
  const inlines = [{ text: '日本語 ', marks: ['bold', 'italic', 'underline'] }];
  const blocks = [
    { id: 'h', type: 'heading', level: 2, inlines },
    { id: 'p', type: 'paragraph', inlines },
    { id: 'l', type: 'list', ordered: false, items: [inlines] },
    { id: 't', type: 'table', headers: [], rows: [[inlines]] },
    {
      id: 'e',
      type: 'example',
      japanese: '日本語',
      reading: 'にほんご',
      translations: { en: 'Japanese', vi: 'Tiếng Nhật' },
    },
    { id: 'c', type: 'callout', variant: 'tip', inlines },
    { id: 'q', type: 'quote', inlines },
    { id: 'd', type: 'divider' },
  ];
  it('accepts all eight block types and empty existing content', () => {
    expect(isGrammarDocument({ blocks })).toBe(true);
    expect(isGrammarDocument({ blocks: [] })).toBe(true);
    expect(
      isLessonContentResponse({
        lessonId: 9,
        schemaVersion: 1,
        version: 1,
        content: { blocks },
        createdAt: '2026-11-06T01:00:00',
        updatedAt: '2026-11-06T01:00:00',
      }),
    ).toBe(true);
  });
  it('rejects unknown fields, duplicate IDs, invalid marks, unsafe text and malformed tables', () => {
    expect(isGrammarDocument({ blocks, extra: true })).toBe(false);
    expect(isGrammarDocument({ blocks: [blocks[0], blocks[0]] })).toBe(false);
    for (const invalid of [
      { id: 'p', type: 'paragraph', inlines: [{ text: '<script>', marks: [] }] },
      { id: 'p', type: 'paragraph', inlines: [{ text: 'text', marks: ['bold', 'bold'] }] },
      { id: 't', type: 'table', headers: [], rows: [[inlines], [inlines, inlines]] },
    ])
      expect(isGrammarDocument({ blocks: [invalid] })).toBe(false);
  });
});
