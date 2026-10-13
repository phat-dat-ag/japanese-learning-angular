import { ApiValidationError, isRecord } from '../../../../core/api/api-response.model';
import { QuestionFormValue, validateAnswerOptions, validateQuestion } from './question-form.model';
import { QuizOptionRequest } from './quiz-question.model';

// Local preview limit matches the backend default; deployment limits remain authoritative.
export const QUIZ_PREVIEW_MAX_BYTES = 1048576;
export const QUIZ_PREVIEW_PAGE_SIZE = 20;

export interface QuestionImportPreview {
  readonly index: number;
  readonly original: unknown;
  readonly sourceType: string;
  readonly fields: readonly { label: string; value: string }[];
  readonly options: readonly { text: string; correct: boolean | null }[];
  readonly errors: readonly ApiValidationError[];
}

export type QuestionImportResult =
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly questions: readonly QuestionImportPreview[] };

export function validateQuizFile(file: File): string | null {
  if (!file.size) return 'The file is empty. Choose a nonempty JSON array of questions.';
  if (file.size > QUIZ_PREVIEW_MAX_BYTES)
    return 'Local preview supports files up to 1 MiB (1,048,576 bytes). Choose a smaller file.';
  return null;
}

export function parseQuizImport(text: string): QuestionImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      status: 'error',
      message:
        'Malformed JSON. Check the file syntax, including commas, quotes, and trailing content, then select it again.',
    };
  }
  if (hasDuplicateKeys(text))
    return {
      status: 'error',
      message:
        'Duplicate JSON property names are not allowed. Remove duplicate keys and select the file again.',
    };
  if (!Array.isArray(value))
    return {
      status: 'error',
      message: 'Use a top-level JSON array of question objects, not an envelope.',
    };
  if (!value.length)
    return {
      status: 'error',
      message: 'The question array is empty. Include at least one question.',
    };
  return {
    status: 'ready',
    questions: value.map((item: unknown, index: number) => previewQuestion(item, index)),
  };
}

// JSON.parse validates syntax first. This token pass detects duplicate decoded keys
// without changing values or mistaking punctuation inside strings for structure.
function hasDuplicateKeys(text: string): boolean {
  const stack: { keys: Set<string> | null; expectingKey: boolean }[] = [];
  const tokens = text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/g);
  for (const [token] of tokens) {
    const current = stack.at(-1);
    if (token === '{' || token === '[')
      stack.push({ keys: token === '{' ? new Set() : null, expectingKey: token === '{' });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && current?.keys) current.expectingKey = true;
    else if (token.startsWith('"') && current?.keys && current.expectingKey) {
      const key: unknown = JSON.parse(token);
      if (typeof key !== 'string') continue;
      if (current.keys.has(key)) return true;
      current.keys.add(key);
      current.expectingKey = false;
    }
  }
  return false;
}

function display(value: unknown): string {
  if (value === undefined) return 'Missing';
  if (value === null) return 'None';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function previewQuestion(original: unknown, index: number): QuestionImportPreview {
  const errors: ApiValidationError[] = [];
  const error = (field: string, message: string) =>
    errors.push({ field: '[' + index + ']' + (field ? '.' + field : ''), message });
  const item = isRecord(original) ? original : {};
  if (!isRecord(original)) error('', 'Each entry must be a nonnull question object.');
  const content = isRecord(item['content']) ? item['content'] : {};
  if (!isRecord(item['content'])) error('content', 'A content object is required.');
  const unknownFields = (
    record: Record<string, unknown>,
    allowed: readonly string[],
    prefix: string,
  ) => {
    for (const key of Object.keys(record))
      if (!allowed.includes(key))
        error(prefix + key, 'Unknown field in the question creation contract.');
  };
  unknownFields(item, ['content', 'options'], '');
  unknownFields(
    content,
    [
      'sourceType',
      'exampleId',
      'vocabularyId',
      'sentenceReading',
      'targetStart',
      'targetLength',
      'targetReading',
      'explanationVi',
      'explanationEn',
      'levelIds',
      'lessonIds',
    ],
    'content.',
  );
  const textField = (key: string, required = false): string => {
    const value = content[key];
    if (!required && (value === undefined || value === null)) return '';
    if (typeof value === 'string') return value;
    error('content.' + key, 'Must be a string' + (required ? ' and is required.' : ' or null.'));
    return '';
  };
  const numberField = (key: string, required = false): number | null => {
    const value = content[key];
    if (!required && (value === undefined || value === null)) return null;
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
    error(
      'content.' + key,
      'Must be a safe whole number' + (required ? ' and is required.' : ' or null.'),
    );
    return null;
  };
  const idsField = (key: string): string => {
    const value: unknown = content[key];
    if (
      !Array.isArray(value) ||
      !value.every((id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
    ) {
      error(
        'content.' + key,
        'A list of positive whole-number IDs is required; use [] for no assignments.',
      );
      return '';
    }
    return value.join(',');
  };
  const sourceType = content['sourceType'];
  if (sourceType !== 'CUSTOM' && sourceType !== 'EXAMPLE')
    error('content.sourceType', 'Choose CUSTOM or EXAMPLE.');
  if (sourceType === 'CUSTOM' && content['exampleId'] != null)
    error('content.exampleId', 'CUSTOM questions cannot reference an example.');
  if (sourceType === 'EXAMPLE' && content['sentenceReading'] != null)
    error(
      'content.sentenceReading',
      'EXAMPLE questions use the backend source reading and cannot supply sentenceReading.',
    );
  const rawOptions: readonly unknown[] = Array.isArray(item['options']) ? item['options'] : [];
  if (!Array.isArray(item['options']))
    error('options', 'An array of four answer option objects is required.');
  const options: QuizOptionRequest[] = [];
  for (const [position, option] of rawOptions.entries()) {
    const field = 'options[' + position + ']';
    if (!isRecord(option)) {
      error(field, 'Must be an option object with text and correct.');
      continue;
    }
    unknownFields(option, ['text', 'correct'], field + '.');
    if (typeof option['text'] !== 'string') error(field + '.text', 'Option text must be a string.');
    if (typeof option['correct'] !== 'boolean')
      error(field + '.correct', 'Correct must be a boolean (true or false).');
    if (typeof option['text'] === 'string' && typeof option['correct'] === 'boolean')
      options.push({ text: option['text'], correct: option['correct'] });
  }
  const value: QuestionFormValue = {
    sourceType: sourceType === 'EXAMPLE' ? 'EXAMPLE' : 'CUSTOM',
    exampleId: numberField('exampleId', sourceType === 'EXAMPLE'),
    vocabularyId: numberField('vocabularyId'),
    sentenceReading: textField('sentenceReading', sourceType === 'CUSTOM'),
    targetStart: numberField('targetStart', true),
    targetLength: numberField('targetLength', true),
    targetReading: textField('targetReading', true),
    explanationVi: textField('explanationVi'),
    explanationEn: textField('explanationEn'),
    levelIds: idsField('levelIds'),
    lessonIds: idsField('lessonIds'),
    options: [],
    correctIndex: null,
  };
  for (const [field, message] of Object.entries(validateQuestion(value, false)))
    error('content.' + field, message);
  for (const [field, message] of Object.entries(validateAnswerOptions(options)))
    error(field === 'correctIndex' ? 'options.correct' : field, message);
  return {
    index,
    original,
    sourceType: display(sourceType),
    errors,
    fields: [
      {
        label: 'Sentence reading',
        value:
          sourceType === 'EXAMPLE'
            ? 'Resolved from the example by the backend; target bounds and source matching are not checked locally.'
            : display(content['sentenceReading']),
      },
      ...[
        'exampleId',
        'vocabularyId',
        'targetStart',
        'targetLength',
        'targetReading',
        'levelIds',
        'lessonIds',
        'explanationVi',
        'explanationEn',
      ].map((key) => ({ label: key, value: display(content[key]) })),
    ],
    options: rawOptions.map((option) => ({
      text: isRecord(option) ? display(option['text']) : display(option),
      correct:
        isRecord(option) && typeof option['correct'] === 'boolean' ? option['correct'] : null,
    })),
  };
}
