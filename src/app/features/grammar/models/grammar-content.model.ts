import { isRecord } from '../../../core/api/api-response.model';
import { positiveInteger } from './lesson.model';

export type GrammarMark = 'bold' | 'italic' | 'underline';
export interface GrammarInline {
  readonly text: string;
  readonly marks: readonly GrammarMark[];
}
export type GrammarInlines = readonly GrammarInline[];
interface GrammarBlockBase {
  readonly id: string;
}
export type GrammarBlock = GrammarBlockBase &
  (
    | {
        readonly type: 'heading';
        readonly level: 1 | 2 | 3 | 4 | 5 | 6;
        readonly inlines: GrammarInlines;
      }
    | { readonly type: 'paragraph' | 'quote'; readonly inlines: GrammarInlines }
    | {
        readonly type: 'list';
        readonly ordered: boolean;
        readonly items: readonly GrammarInlines[];
      }
    | {
        readonly type: 'table';
        readonly headers: readonly GrammarInlines[];
        readonly rows: readonly (readonly GrammarInlines[])[];
      }
    | {
        readonly type: 'example';
        readonly japanese: string;
        readonly reading: string;
        readonly translations: { readonly en: string; readonly vi: string };
      }
    | {
        readonly type: 'callout';
        readonly variant: 'note' | 'tip' | 'warning' | 'information';
        readonly inlines: GrammarInlines;
      }
    | { readonly type: 'divider' }
  );
export interface GrammarDocument {
  readonly blocks: readonly GrammarBlock[];
}
export interface LessonContentWriteRequest {
  readonly schemaVersion: 1;
  readonly expectedVersion: number;
  readonly content: GrammarDocument;
}
export interface LessonContentResponse {
  readonly lessonId: number;
  readonly schemaVersion: 1;
  readonly version: number;
  readonly content: GrammarDocument;
  readonly createdAt: string;
  readonly updatedAt: string;
}
// The quoted ETag comes from HTTP headers; it must never be reconstructed from the body.
export interface LessonContentSnapshot {
  readonly document: LessonContentResponse;
  readonly etag: string;
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value);
}
export function validGrammarText(value: unknown, nonblank = false): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 10000 &&
    (!nonblank ||
      /[^\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/.test(
        value,
      )) &&
    !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)
  );
}
function inlines(value: unknown): value is GrammarInlines {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 100 &&
    value.every(
      (inline: unknown) =>
        isRecord(inline) &&
        keys(inline, ['text', 'marks']) &&
        validGrammarText(inline['text']) &&
        Array.isArray(inline['marks']) &&
        inline['marks'].length <= 3 &&
        new Set(inline['marks']).size === inline['marks'].length &&
        inline['marks'].every(
          (mark: unknown) => mark === 'bold' || mark === 'italic' || mark === 'underline',
        ),
    )
  );
}
export function isGrammarBlock(value: unknown): value is GrammarBlock {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value['id'])
  )
    return false;
  const exact = (...fields: string[]) => keys(value, ['id', 'type', ...fields]);
  switch (value['type']) {
    case 'heading':
      return (
        exact('level', 'inlines') &&
        positiveInteger(value['level']) &&
        value['level'] <= 6 &&
        inlines(value['inlines'])
      );
    case 'paragraph':
    case 'quote':
      return exact('inlines') && inlines(value['inlines']);
    case 'divider':
      return exact();
    case 'callout':
      return (
        exact('variant', 'inlines') &&
        ['note', 'tip', 'warning', 'information'].includes(value['variant'] as string) &&
        inlines(value['inlines'])
      );
    case 'example': {
      const translations = value['translations'];
      return (
        exact('japanese', 'reading', 'translations') &&
        validGrammarText(value['japanese'], true) &&
        validGrammarText(value['reading'], true) &&
        isRecord(translations) &&
        keys(translations, ['en', 'vi']) &&
        validGrammarText(translations['en'], true) &&
        validGrammarText(translations['vi'], true)
      );
    }
    case 'list':
      return (
        exact('ordered', 'items') &&
        typeof value['ordered'] === 'boolean' &&
        Array.isArray(value['items']) &&
        value['items'].length >= 1 &&
        value['items'].length <= 100 &&
        value['items'].every(inlines)
      );
    case 'table': {
      const rows = value['rows'];
      const headers = value['headers'];
      if (
        !exact('headers', 'rows') ||
        !Array.isArray(rows) ||
        rows.length < 1 ||
        rows.length > 100 ||
        !Array.isArray(rows[0]) ||
        rows[0].length < 1 ||
        rows[0].length > 20 ||
        !Array.isArray(headers)
      )
        return false;
      const width = rows[0].length;
      return (
        (headers.length === 0 || headers.length === width) &&
        headers.every(inlines) &&
        rows.every(
          (row: unknown) => Array.isArray(row) && row.length === width && row.every(inlines),
        )
      );
    }
    default:
      return false;
  }
}
export function isGrammarDocument(value: unknown): value is GrammarDocument {
  if (
    !isRecord(value) ||
    !keys(value, ['blocks']) ||
    !Array.isArray(value['blocks']) ||
    value['blocks'].length > 200 ||
    !value['blocks'].every(isGrammarBlock)
  )
    return false;
  return (
    new Set(value['blocks'].map((item) => item.id)).size === value['blocks'].length &&
    new TextEncoder().encode(JSON.stringify(value)).length <= 1048576
  );
}
export function isLessonContentResponse(value: unknown): value is LessonContentResponse {
  return (
    isRecord(value) &&
    keys(value, ['lessonId', 'schemaVersion', 'version', 'content', 'createdAt', 'updatedAt']) &&
    positiveInteger(value['lessonId']) &&
    value['schemaVersion'] === 1 &&
    positiveInteger(value['version']) &&
    isGrammarDocument(value['content']) &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}
