import {
  grammarImportItemFixture,
  grammarImportReportFixture,
} from '../testing/lesson-import.fixture';
import {
  GRAMMAR_IMPORT_MAX_BYTES,
  isGrammarImportResponse,
  parseGrammarImport,
  validateGrammarImportFile,
} from './lesson-import.model';

describe('Complete grammar import validation', () => {
  it('accepts actual schema-v1 documents with all blocks and optional description/etag', () => {
    expect(parseGrammarImport(JSON.stringify([grammarImportItemFixture()]))).toEqual({
      status: 'ready',
      count: 1,
    });
    const item = { ...grammarImportItemFixture(), expectedVersion: 4, etag: '"exact:quoted:4"' };
    expect(parseGrammarImport(JSON.stringify([item]))).toEqual({ status: 'ready', count: 1 });
    const { description, ...withoutDescription } = item;
    expect(parseGrammarImport(JSON.stringify([withoutDescription])).status).toBe('ready');
  });
  it.each(['', '{', '{}', 'null', '[]', '[null]', '[1]', '[] []'])(
    'rejects invalid/root JSON %s',
    (text) => {
      expect(parseGrammarImport(text).status).toBe('error');
    },
  );
  it('rejects wrong fields, invalid metadata, versions, schema and content', () => {
    const valid = grammarImportItemFixture();
    for (const change of [
      { owner: 'invented' },
      { level: '' },
      { title: ' ' },
      { title: 'x'.repeat(201) },
      { description: 'x'.repeat(1001) },
      { lessonNumber: '1' },
      { lessonNumber: 0 },
      { displayOrder: 1.5 },
      { schemaVersion: 2 },
      { expectedVersion: -1 },
      { expectedVersion: '0' },
      { etag: 1 },
      { content: { blocks: [{ id: 'x', type: 'html', html: '<script>' }] } },
    ])
      expect(parseGrammarImport(JSON.stringify([{ ...valid, ...change }])).status).toBe('error');
  });
  it('bounds item/file sizes and catches duplicate lesson keys and orders without changing level text', () => {
    const item = grammarImportItemFixture();
    expect(
      parseGrammarImport(JSON.stringify([item, { ...item, level: ' N5 ', displayOrder: 2 }]))
        .status,
    ).toBe('error');
    expect(parseGrammarImport(JSON.stringify([item, { ...item, lessonNumber: 2 }])).status).toBe(
      'error',
    );
    expect(
      parseGrammarImport(
        JSON.stringify(
          Array.from({ length: 100 }, (_, i) => ({
            ...item,
            lessonNumber: i + 1,
            displayOrder: i + 1,
          })),
        ),
      ).status,
    ).toBe('ready');
    expect(
      parseGrammarImport(
        JSON.stringify(
          Array.from({ length: 101 }, (_, i) => ({
            ...item,
            lessonNumber: i + 1,
            displayOrder: i + 1,
          })),
        ),
      ).status,
    ).toBe('error');
    expect(validateGrammarImportFile(null)).toBeTruthy();
    expect(validateGrammarImportFile(new File([], 'empty.json'))).toBeTruthy();
    expect(
      validateGrammarImportFile(new File([new Uint8Array(GRAMMAR_IMPORT_MAX_BYTES)], 'max.json')),
    ).toBeNull();
    expect(
      validateGrammarImportFile(
        new File([new Uint8Array(GRAMMAR_IMPORT_MAX_BYTES + 1)], 'large.json'),
      ),
    ).toContain('5 MiB');
  });
  it('does not impose the direct-PUT token limit on import documents', () => {
    const content = {
      blocks: Array.from({ length: 200 }, (_, i) => ({
        id: `l-${i}`,
        type: 'list',
        ordered: false,
        items: Array.from({ length: 100 }, () => [{ text: 'x', marks: [] }]),
      })),
    };
    expect(
      parseGrammarImport(JSON.stringify([{ ...grammarImportItemFixture(), content }])).status,
    ).toBe('ready');
  });
});
describe('Import report runtime guard', () => {
  it('accepts mixed statuses and nullable optional fields', () => {
    expect(isGrammarImportResponse(grammarImportReportFixture())).toBe(true);
  });
  it('rejects malformed counts, missing errors, duplicate indices and inconsistent status totals', () => {
    const report = grammarImportReportFixture();
    for (const invalid of [
      { ...report, total: 5 },
      { ...report, created: -1 },
      { ...report, created: 0, updated: 2 },
      { ...report, results: report.results.map((item) => ({ ...item, index: 0 })) },
      { ...report, results: report.results.map((item) => ({ ...item, status: 'UNKNOWN' })) },
      { ...report, results: report.results.map((item) => ({ ...item, error: null })) },
      { ...report, results: report.results.map((item) => ({ ...item, lessonId: -1 })) },
    ])
      expect(isGrammarImportResponse(invalid)).toBe(false);
  });
});
