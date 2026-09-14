import { isRecord } from '../../../core/api/api-response.model';
import { FlashcardLevelCode } from './flashcard-level.model';

export interface JlptLevelResponse {
  readonly code: string;
  readonly name: string;
}

export interface JlptLevel extends JlptLevelResponse {
  readonly code: FlashcardLevelCode;
}

// Validate the transport shape separately from the levels supported by the app.
export function isJlptLevelResponses(value: unknown): value is readonly JlptLevelResponse[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const codes = new Set<string>();
  return value.every((level: unknown) => {
    if (
      !isRecord(level) ||
      typeof level['code'] !== 'string' ||
      level['code'].trim().length === 0 ||
      typeof level['name'] !== 'string' ||
      level['name'].trim().length === 0 ||
      codes.has(level['code'])
    ) {
      return false;
    }
    codes.add(level['code']);
    return true;
  });
}

export function isSupportedJlptLevel(level: JlptLevelResponse): level is JlptLevel {
  return /^N[1-5]$/.test(level.code);
}
