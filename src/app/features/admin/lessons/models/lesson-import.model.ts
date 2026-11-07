import { ApiErrorBody, isRecord } from '../../../../core/api/api-response.model';
import { GrammarDocument, isGrammarDocument } from './grammar-content.model';
import { positiveInteger, validateLessonMetadataFields } from './lesson.model';

export const GRAMMAR_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const GRAMMAR_IMPORT_MAX_ITEMS = 100;
export const GRAMMAR_IMPORT_MODES = ['SKIP_EXISTING', 'UPDATE_EXISTING'] as const;
export type GrammarImportMode = (typeof GRAMMAR_IMPORT_MODES)[number];
export interface GrammarImportItem {
  readonly level: string;
  readonly lessonNumber: number;
  readonly title: string;
  readonly description?: string | null;
  readonly displayOrder: number;
  readonly schemaVersion: 1;
  readonly expectedVersion: number;
  readonly etag?: string | null;
  readonly content: GrammarDocument;
}
interface GrammarImportResultBase {
  readonly index: number;
  readonly level: string;
  readonly lessonNumber: number;
  readonly lessonId?: number | null;
}
export type GrammarImportResult = GrammarImportResultBase &
  (
    | { readonly status: 'CREATED' | 'UPDATED' | 'SKIPPED'; readonly error?: null }
    | { readonly status: 'FAILED'; readonly error: ApiErrorBody }
  );
export interface GrammarImportResponse {
  readonly total: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly failed: number;
  readonly results: readonly GrammarImportResult[];
}
export type GrammarImportPreview =
  | { readonly status: 'ready'; readonly count: number }
  | { readonly status: 'error'; readonly issues: readonly string[] };

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function errorBody(value: unknown): value is ApiErrorBody {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    Array.isArray(value['details']) &&
    value['details'].every(
      (detail: unknown) =>
        isRecord(detail) &&
        typeof detail['field'] === 'string' &&
        typeof detail['message'] === 'string',
    )
  );
}
function result(value: unknown): value is GrammarImportResult {
  if (
    !isRecord(value) ||
    !count(value['index']) ||
    typeof value['level'] !== 'string' ||
    !value['level'].trim() ||
    !positiveInteger(value['lessonNumber']) ||
    (value['lessonId'] != null && !positiveInteger(value['lessonId']))
  )
    return false;
  return value['status'] === 'FAILED'
    ? errorBody(value['error'])
    : (value['status'] === 'CREATED' ||
        value['status'] === 'UPDATED' ||
        value['status'] === 'SKIPPED') &&
        value['error'] == null;
}
export function isGrammarImportResponse(value: unknown): value is GrammarImportResponse {
  if (
    !isRecord(value) ||
    !positiveInteger(value['total']) ||
    value['total'] > 500 ||
    !count(value['created']) ||
    !count(value['updated']) ||
    !count(value['skipped']) ||
    !count(value['failed']) ||
    !Array.isArray(value['results'])
  )
    return false;
  const results: unknown[] = value['results'];
  return (
    value['created'] + value['updated'] + value['skipped'] + value['failed'] === value['total'] &&
    results.length === value['total'] &&
    results.every(result) &&
    results.every((item, index) => item.index === index) &&
    results.filter((item) => item.status === 'CREATED').length === value['created'] &&
    results.filter((item) => item.status === 'UPDATED').length === value['updated'] &&
    results.filter((item) => item.status === 'SKIPPED').length === value['skipped'] &&
    results.filter((item) => item.status === 'FAILED').length === value['failed']
  );
}
export function validateGrammarImportFile(file: File | null): string | null {
  if (!file) return 'Choose a UTF-8 JSON file.';
  if (!file.size) return 'The selected file is empty.';
  return file.size > GRAMMAR_IMPORT_MAX_BYTES
    ? 'Grammar import files must be at most 5 MiB (5,242,880 bytes).'
    : null;
}
export function parseGrammarImport(text: string): GrammarImportPreview {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      status: 'error',
      issues: ['The file must contain valid JSON: one array of complete grammar lessons.'],
    };
  }
  if (!Array.isArray(value) || !value.length || value.length > GRAMMAR_IMPORT_MAX_ITEMS)
    return {
      status: 'error',
      issues: ['Choose a JSON array containing 1–100 complete grammar lessons.'],
    };
  const issues: string[] = [];
  const lessonKeys = new Set<string>();
  const orderKeys = new Set<string>();
  const allowed = [
    'level',
    'lessonNumber',
    'title',
    'description',
    'displayOrder',
    'schemaVersion',
    'expectedVersion',
    'etag',
    'content',
  ];
  value.forEach((item: unknown, index) => {
    const prefix = `Item ${index + 1}`;
    if (!isRecord(item)) {
      issues.push(`${prefix}: expected a lesson object.`);
      return;
    }
    if (Object.keys(item).some((key) => !allowed.includes(key)))
      issues.push(`${prefix}: contains unsupported fields.`);
    if (typeof item['level'] !== 'string' || !item['level'].trim() || item['level'].length > 10)
      issues.push(
        `${prefix}: level is required, at most 10 characters. The server resolves existing level codes.`,
      );
    const errors = validateLessonMetadataFields({
      lessonNumber: item['lessonNumber'] as number,
      title: item['title'] as string,
      description: item['description'] == null ? null : (item['description'] as string),
      displayOrder: item['displayOrder'] as number,
    });
    for (const [field, message] of Object.entries(errors))
      issues.push(`${prefix}, ${field}: ${message}`);
    if (item['schemaVersion'] !== 1) issues.push(`${prefix}: schemaVersion must be 1.`);
    if (!count(item['expectedVersion']))
      issues.push(`${prefix}: expectedVersion must be a nonnegative safe integer.`);
    if (item['etag'] != null && (typeof item['etag'] !== 'string' || item['etag'].length > 200))
      issues.push(
        `${prefix}: etag must be a string of at most 200 characters, copied exactly from the content response.`,
      );
    if (!isGrammarDocument(item['content']))
      issues.push(
        `${prefix}: content must match grammar schema v1 (plain text, valid blocks/IDs/marks, list/table limits, maximum 1 MiB per document).`,
      );
    if (
      typeof item['level'] === 'string' &&
      positiveInteger(item['lessonNumber']) &&
      positiveInteger(item['displayOrder'])
    ) {
      const lessonKey = JSON.stringify([item['level'].trim(), item['lessonNumber']]);
      const orderKey = JSON.stringify([item['level'].trim(), item['displayOrder']]);
      if (lessonKeys.has(lessonKey) || orderKeys.has(orderKey))
        issues.push(`${prefix}: duplicate lesson number or display order within a level.`);
      lessonKeys.add(lessonKey);
      orderKeys.add(orderKey);
    }
  });
  return issues.length ? { status: 'error', issues } : { status: 'ready', count: value.length };
}
