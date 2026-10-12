import { parseQuizImport, QUIZ_PREVIEW_MAX_BYTES, validateQuizFile } from './question-import.model';
import { quizImportFixture } from '../testing/question-import.fixture';

function preview(value: unknown) {
  const result = parseQuizImport(JSON.stringify([value]));
  if (result.status !== 'ready') throw new Error('Expected parsed preview');
  return result.questions[0];
}

describe('Quiz import local validation', () => {
  it('accepts CUSTOM creation objects and leaves every input value intact', () => {
    const value = quizImportFixture();
    const result = preview(value);
    expect(result.errors).toEqual([]);
    expect(result.original).toEqual(value);
    expect(result.index).toBe(0);
    expect(result.options.filter((option) => option.correct)).toHaveLength(1);
  });
  it('accepts EXAMPLE references without inventing a source reading', () => {
    const { sentenceReading, ...content } = quizImportFixture().content;
    const result = preview({
      ...quizImportFixture(),
      content: { ...content, sourceType: 'EXAMPLE', exampleId: 17 },
    });
    expect(result.errors).toEqual([]);
    expect(result.fields[0].value).toContain('not checked locally');
  });
  it.each(['', '[', '[{},]', '[] trailing', '{}', 'null', '{"questions":[]}', '[]'])(
    'rejects invalid file structure: %s',
    (text) => {
      expect(parseQuizImport(text).status).toBe('error');
    },
  );
  it('rejects duplicate decoded JSON keys without confusing keys in different objects or strings', () => {
    expect(parseQuizImport('[{"content":{},"content":{}}]').status).toBe('error');
    expect(parseQuizImport('[{"a":1,"\\u0061":2}]').status).toBe('error');
    const value = quizImportFixture();
    const result = parseQuizImport(
      JSON.stringify([
        value,
        {
          ...value,
          content: {
            ...value.content,
            explanationEn: 'A string with {"a":1,"a":2}, brackets [] and quotes',
          },
        },
      ]),
    );
    expect(result.status).toBe('ready');
    if (result.status === 'ready')
      expect(result.questions.every((item) => !item.errors.length)).toBe(true);
  });
  it.each([null, 12, 'text', [], {}, { content: null, options: null }])(
    'reports invalid entries without rejecting the remaining array',
    (entry) => {
      const result = parseQuizImport(JSON.stringify([entry, quizImportFixture()]));
      expect(result.status).toBe('ready');
      if (result.status === 'ready') {
        expect(result.questions[0].errors.length).toBeGreaterThan(0);
        expect(result.questions[0].errors[0].field).toMatch(/^\[0\]/);
        expect(result.questions[1].errors).toEqual([]);
        expect(result.questions[1].index).toBe(1);
      }
    },
  );
  it.each([
    { sourceType: 'OTHER' },
    { exampleId: 1 },
    { sentenceReading: null },
    { targetStart: '1' },
    { targetStart: -1 },
    { targetStart: 2147483648 },
    { targetLength: 0 },
    { targetLength: 201 },
    { targetReading: 'A' },
    { vocabularyId: 9007199254740992 },
    { levelIds: null },
    { lessonIds: ['2'] },
    { levelIds: [1, 1] },
    { levelIds: Array.from({ length: 101 }, (_, i) => i + 1) },
    { explanationVi: 'x'.repeat(2001) },
    { unexpected: true },
  ])('validates content fields without coercion: %j', (change) => {
    const value = quizImportFixture();
    expect(
      preview({ ...value, content: { ...value.content, ...change } }).errors.length,
    ).toBeGreaterThan(0);
  });
  it('validates EXAMPLE source requirements', () => {
    const value = quizImportFixture();
    expect(
      preview({ ...value, content: { ...value.content, sourceType: 'EXAMPLE' } }).errors.some(
        (error) => error.field.endsWith('exampleId'),
      ),
    ).toBe(true);
    expect(
      preview({
        ...value,
        content: { ...value.content, sourceType: 'EXAMPLE', exampleId: 2 },
      }).errors.some((error) => error.field.endsWith('sentenceReading')),
    ).toBe(true);
  });
  it('uses code-point target offsets and exact unnormalized matching', () => {
    const value = quizImportFixture();
    expect(preview(value).errors).toEqual([]);
    expect(
      preview({ ...value, content: { ...value.content, targetStart: 2 } }).errors.length,
    ).toBeGreaterThan(0);
    expect(
      preview({
        ...value,
        content: {
          ...value.content,
          sentenceReading: '\u304b\u3099',
          targetStart: 0,
          targetLength: 1,
          targetReading: '\u304c',
        },
      }).errors.length,
    ).toBeGreaterThan(0);
  });
  it.each(['', '   ', 'B', '\uFF22', ' A', 'A ', 'a'.repeat(201)])(
    'rejects invalid option text: %s',
    (text) => {
      const value = quizImportFixture();
      const options = value.options.map((option, index) =>
        index === 0 ? { ...option, text } : option,
      );
      expect(
        preview({ ...value, options }).errors.some((error) => error.field === '[0].options'),
      ).toBe(true);
      expect(preview({ ...value, options }).options[0].text).toBe(text);
    },
  );
  it.each([0, 2, 4])('rejects %s correct answers', (count) => {
    const value = quizImportFixture();
    expect(
      preview({
        ...value,
        options: value.options.map((option, index) => ({ ...option, correct: index < count })),
      }).errors.some((error) => error.field.endsWith('options.correct')),
    ).toBe(true);
  });
  it('rejects wrong option counts, types, and unknown fields', () => {
    const value = quizImportFixture();
    for (const options of [
      value.options.slice(0, 3),
      [...value.options, { text: 'E', correct: false }],
      [null, ...value.options.slice(1)],
      [{ text: 'A', correct: 'true' }, ...value.options.slice(1)],
      [{ text: 'A', correct: true, id: 9 }, ...value.options.slice(1)],
    ]) {
      expect(preview({ ...value, options }).errors.length).toBeGreaterThan(0);
    }
  });
  it('accepts optional nulls without changing the original object', () => {
    const value = quizImportFixture();
    const original = {
      ...value,
      content: { ...value.content, exampleId: null, vocabularyId: null, explanationEn: null },
    };
    expect(preview(original).errors).toEqual([]);
    expect(preview(original).original).toEqual(original);
  });
  it('checks extension, empty files, and the local size limit without trusting MIME type', () => {
    expect(validateQuizFile(new File(['[]'], 'quiz.JSON', { type: '' }))).toBeNull();
    expect(validateQuizFile(new File(['[]'], 'quiz.txt', { type: 'application/json' }))).toContain(
      '.json',
    );
    expect(validateQuizFile(new File([], 'quiz.json'))).toContain('empty');
    expect(
      validateQuizFile(new File(['x'.repeat(QUIZ_PREVIEW_MAX_BYTES + 1)], 'quiz.json')),
    ).toContain('1 MiB');
  });
});
