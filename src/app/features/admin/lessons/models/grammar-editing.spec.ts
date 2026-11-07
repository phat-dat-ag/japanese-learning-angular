import { GrammarDocument, isGrammarDocument, validGrammarText } from './grammar-content.model';
import {
  createGrammarBlock,
  GRAMMAR_BLOCK_TYPES,
  grammarDocumentBytes,
  moveGrammarBlock,
  serializeGrammarDocument,
  validateGrammarDocument,
} from './grammar-editing';
import { grammarDocumentFixture } from '../testing/grammar-content.fixture';

describe('Grammar editing and schema boundaries', () => {
  it('creates all eight blocks with stable caller IDs and serializes Unicode losslessly', () => {
    GRAMMAR_BLOCK_TYPES.forEach((type) =>
      expect(createGrammarBlock(type, 'stable-id')).toMatchObject({ id: 'stable-id', type }),
    );
    const document = grammarDocumentFixture();
    expect(validateGrammarDocument(document)).toEqual([]);
    expect(JSON.parse(serializeGrammarDocument(document))).toEqual(document);
    expect(validateGrammarDocument({ blocks: [] })).toEqual([]);
  });
  it('moves blocks without modifying IDs or the original document', () => {
    const source = grammarDocumentFixture();
    const moved = moveGrammarBlock(source, 'h', 1);
    expect(moved.blocks.slice(0, 2).map((block) => block.id)).toEqual(['p', 'h']);
    expect(source.blocks[0].id).toBe('h');
    expect(moveGrammarBlock(source, 'h', -1)).toBe(source);
    expect(moveGrammarBlock(source, 'missing', 1)).toBe(source);
  });
  it('enforces block IDs, heading levels, exact properties and 200-block maximum', () => {
    const blocks = Array.from({ length: 200 }, (_, i) => createGrammarBlock('divider', `b-${i}`));
    expect(isGrammarDocument({ blocks })).toBe(true);
    expect(
      validateGrammarDocument({ blocks: [...blocks, createGrammarBlock('divider', 'extra')] }),
    ).not.toEqual([]);
    for (const block of [
      { id: 'bad id', type: 'divider' },
      { id: 'b', type: 'heading', level: 7, inlines: [{ text: 'ok', marks: [] }] },
      { id: 'b', type: 'divider', html: 'extra' },
      null,
    ])
      expect(isGrammarDocument({ blocks: [block] })).toBe(false);
    expect(validateGrammarDocument({ blocks: [blocks[0], blocks[0]] })[0].message).toContain(
      'duplicate',
    );
  });
  it('matches UTF-16 text lengths, Java blank rules and forbidden control/markup characters', () => {
    expect(validGrammarText('𠮷'.repeat(5000))).toBe(true);
    expect(validGrammarText('𠮷'.repeat(5001))).toBe(false);
    expect(validGrammarText(' \t\r\n')).toBe(true);
    expect(validGrammarText(' \t\r\n', true)).toBe(false);
    expect(validGrammarText('\u00a0', true)).toBe(true);
    for (const text of ['', '<b>text</b>', 'a\u0000', 'a\u0085'])
      expect(validGrammarText(text)).toBe(false);
  });
  it('bounds lists, inline counts, marks and rectangular tables', () => {
    const cell = [{ text: 'text', marks: [] }];
    const list = {
      id: 'l',
      type: 'list',
      ordered: true,
      items: Array.from({ length: 100 }, () => cell),
    };
    expect(isGrammarDocument({ blocks: [list] })).toBe(true);
    expect(isGrammarDocument({ blocks: [{ ...list, items: [...list.items, cell] }] })).toBe(false);
    const rows = Array.from({ length: 100 }, () => Array.from({ length: 20 }, () => cell));
    const table = { id: 't', type: 'table', headers: rows[0], rows };
    expect(isGrammarDocument({ blocks: [table] })).toBe(true);
    for (const invalid of [
      { ...table, headers: [cell] },
      { ...table, rows: [...rows, rows[0]] },
      { ...table, rows: [Array.from({ length: 21 }, () => cell)] },
      { ...list, items: [] },
      { id: 'p', type: 'paragraph', inlines: Array.from({ length: 101 }, () => cell[0]) },
      { id: 'p', type: 'paragraph', inlines: [{ text: 'x', marks: ['bold', 'bold'] }] },
    ])
      expect(isGrammarDocument({ blocks: [invalid] })).toBe(false);
  });
  it('enforces the exact compact UTF-8 document byte limit', () => {
    const base: GrammarDocument = {
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          inlines: Array.from({ length: 100 }, () => ({ text: 'x'.repeat(10000), marks: [] })),
        },
      ],
    };
    expect(grammarDocumentBytes(base)).toBeLessThan(1048576);
    const overhead = grammarDocumentBytes({
      blocks: [...base.blocks, { id: 'p2', type: 'paragraph', inlines: [{ text: '', marks: [] }] }],
    });
    const remaining = 1048576 - overhead;
    const extra = {
      id: 'p2',
      type: 'paragraph' as const,
      inlines: Array.from({ length: Math.ceil(remaining / 10000) }, (_, i) => ({
        text: 'x'.repeat(Math.min(10000, remaining - i * 10000)),
        marks: [],
      })),
    };
    // Additional run wrappers also count; validate actual compact bytes, not text length alone.
    const tooLarge = { blocks: [...base.blocks, extra] };
    expect(grammarDocumentBytes(tooLarge)).toBeGreaterThan(1048576);
    expect(validateGrammarDocument(tooLarge).some((issue) => issue.message.includes('1 MiB'))).toBe(
      true,
    );
  });
  it('also bounds PUT envelope bytes and token count even when the document alone fits', () => {
    const runs = Array.from({ length: 100 }, () => ({ text: 'x'.repeat(10000), marks: [] }));
    const extraRuns = [
      ...Array.from({ length: 5 }, () => ({ text: 'x'.repeat(9000), marks: [] })),
      { text: '', marks: [] },
    ];
    const exact: GrammarDocument = {
      blocks: [
        { id: 'p', type: 'paragraph', inlines: runs },
        { id: 'p2', type: 'paragraph', inlines: extraRuns },
      ],
    };
    extraRuns[5].text = 'x'.repeat(1048576 - grammarDocumentBytes(exact));
    expect(grammarDocumentBytes(exact)).toBe(1048576);
    expect(isGrammarDocument(exact)).toBe(true);
    expect(
      validateGrammarDocument(exact).some((issue) => issue.message.includes('save request')),
    ).toBe(true);
    extraRuns[5].text += 'x';
    expect(isGrammarDocument(exact)).toBe(false);
    const fragmented: GrammarDocument = {
      blocks: Array.from({ length: 200 }, (_, i) => ({
        id: `l-${i}`,
        type: 'list',
        ordered: true,
        items: Array.from({ length: 100 }, () => [{ text: 'x', marks: [] }]),
      })),
    };
    expect(isGrammarDocument(fragmented)).toBe(true);
    expect(
      validateGrammarDocument(fragmented).some((issue) =>
        issue.message.includes('100,000 JSON tokens'),
      ),
    ).toBe(true);
  });
});
