import {
  GrammarBlock,
  GrammarDocument,
  GrammarInlines,
  isGrammarBlock,
  isGrammarDocument,
} from './grammar-content.model';

export const GRAMMAR_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'list',
  'table',
  'example',
  'callout',
  'quote',
  'divider',
] as const;
export type GrammarBlockType = (typeof GRAMMAR_BLOCK_TYPES)[number];
export const emptyInlines = (): GrammarInlines => [{ text: '', marks: [] }];

export function createGrammarBlock(type: GrammarBlockType, id: string): GrammarBlock {
  switch (type) {
    case 'heading':
      return { id, type, level: 2, inlines: emptyInlines() };
    case 'paragraph':
    case 'quote':
      return { id, type, inlines: emptyInlines() };
    case 'list':
      return { id, type, ordered: false, items: [emptyInlines()] };
    case 'table':
      return { id, type, headers: [], rows: [[emptyInlines()]] };
    case 'example':
      return { id, type, japanese: '', reading: '', translations: { en: '', vi: '' } };
    case 'callout':
      return { id, type, variant: 'note', inlines: emptyInlines() };
    case 'divider':
      return { id, type };
  }
}
export interface GrammarValidationIssue {
  readonly field: string;
  readonly message: string;
}
export function grammarDocumentBytes(document: GrammarDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}
// Jackson counts container starts/ends, property names and scalar values as tokens.
// Seven tokens surround content in the schemaVersion/expectedVersion/content PUT envelope.
function jsonTokens(value: unknown): number {
  if (Array.isArray(value))
    return 2 + value.reduce((total, item: unknown) => total + jsonTokens(item), 0);
  if (typeof value === 'object' && value !== null)
    return (
      2 +
      Object.values(value).reduce<number>((total, item: unknown) => total + 1 + jsonTokens(item), 0)
    );
  return 1;
}
export function validateGrammarDocument(
  value: GrammarDocument,
  expectedVersion = 0,
): readonly GrammarValidationIssue[] {
  const tokens = jsonTokens(value) + 7;
  const requestBytes = new TextEncoder().encode(
    JSON.stringify({ schemaVersion: 1, expectedVersion, content: value }),
  ).length;
  if (isGrammarDocument(value as unknown) && tokens <= 100000 && requestBytes <= 1048576) return [];
  const issues: GrammarValidationIssue[] = [];
  if (value.blocks.length > 200)
    issues.push({ field: 'content.blocks', message: 'Use at most 200 blocks.' });
  const ids = new Set<string>();
  value.blocks.forEach((block, index) => {
    const field = `content.blocks[${index}]`;
    if (ids.has(block.id))
      issues.push({ field, message: `Block ${index + 1}: duplicate block ID.` });
    ids.add(block.id);
    if (!isGrammarBlock(block as unknown))
      issues.push({
        field,
        message: `Block ${index + 1} (${block.type}): complete all required fields. Text runs must contain 1–10,000 characters without angle brackets or control characters. Check list/table limits and formatting.`,
      });
  });
  if (grammarDocumentBytes(value) > 1048576)
    issues.push({
      field: 'content',
      message: 'The compact content document must be at most 1 MiB.',
    });
  if (tokens > 100000)
    issues.push({
      field: 'content',
      message:
        'The document has too many text runs or cells for one save. Reduce fragmentation (maximum 100,000 JSON tokens per request).',
    });
  if (requestBytes > 1048576 && grammarDocumentBytes(value) <= 1048576)
    issues.push({
      field: 'content',
      message:
        'The save request including schema and revision must fit within 1 MiB. Shorten the content slightly.',
    });
  if (!issues.length)
    issues.push({
      field: 'content',
      message: 'The document structure is invalid or contains unsupported fields.',
    });
  return issues;
}
export function serializeGrammarDocument(document: GrammarDocument): string {
  return JSON.stringify(document);
}
export function moveGrammarBlock(
  document: GrammarDocument,
  id: string,
  direction: -1 | 1,
): GrammarDocument {
  const index = document.blocks.findIndex((block) => block.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= document.blocks.length) return document;
  const blocks = [...document.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { blocks };
}
