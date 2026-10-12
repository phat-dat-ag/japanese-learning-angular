import { isRecord } from '../../../../core/api/api-response.model';

export type QuestionSource = 'EXAMPLE' | 'CUSTOM';
export type QuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface QuizQuestionContent {
  readonly vocabularyId?: number;
  /** Offsets count Unicode code points, not UTF-16 units. */
  readonly targetStart: number;
  readonly targetLength: number;
  readonly targetReading: string;
  readonly explanationVi?: string;
  readonly explanationEn?: string;
  readonly levelIds: readonly number[];
  readonly lessonIds: readonly number[];
}

/** Full replacement: omitted optional fields are cleared; source type is immutable. */
export type QuizQuestionContentRequest = QuizQuestionContent &
  (
    | {
      readonly sourceType: 'EXAMPLE';
      readonly exampleId: number;
      readonly sentenceReading?: never;
    }
    | {
      readonly sourceType: 'CUSTOM';
      readonly sentenceReading: string;
      readonly exampleId?: never;
    }
  );

export interface QuizOptionRequest {
  readonly text: string;
  readonly correct: boolean;
}

export interface QuizQuestionCreateRequest {
  readonly content: QuizQuestionContentRequest;
  /** Exactly four NFKC-distinct options, exactly one correct; validated by the backend. */
  readonly options: readonly QuizOptionRequest[];
}

export interface QuizVersionRequest {
  /** Opaque revision from the latest response; never increment locally. */
  readonly version: number;
}

export interface QuizQuestionUpdateRequest extends QuizVersionRequest {
  readonly content: QuizQuestionContentRequest;
}

export interface QuizOptionTextRequest extends QuizVersionRequest {
  readonly text: string;
}

export interface QuizCorrectOptionRequest extends QuizVersionRequest {
  readonly optionId: number;
}

export interface QuizOptionResponse extends QuizOptionRequest {
  readonly id: number;
}

/** Admin-only answer-bearing data. Null backend fields are omitted. */
export interface QuizQuestionResponse extends QuizQuestionContent {
  readonly id: number;
  readonly version: number;
  readonly sourceType: QuestionSource;
  readonly status: QuestionStatus;
  readonly exampleId?: number;
  readonly sentenceReading?: string;
  readonly sourceInvalidated: boolean;
  readonly eligibleForNewGames: boolean;
  readonly options: readonly QuizOptionResponse[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuizQuestionQuery {
  readonly sourceType?: QuestionSource;
  readonly status?: QuestionStatus;
  readonly levelId?: number;
  readonly lessonId?: number;
  readonly vocabularyId?: number;
  readonly exampleId?: number;
  readonly keyword?: string;
  /** Zero-based; defaults to 0. */
  readonly page?: number;
  /** 1–100; defaults to 20. */
  readonly size?: number;
}

export interface QuizQuestionListResponse {
  readonly items: readonly QuizQuestionResponse[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

// ApiSuccess, ApiResponse, ApiFailure and ApiValidationError are shared core/api contracts.
function isInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isIds(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((id: unknown) => isInteger(id, 1));
}

function isOption(value: unknown): value is QuizOptionResponse {
  return (
    isRecord(value) &&
    isInteger(value['id'], 1) &&
    typeof value['text'] === 'string' &&
    typeof value['correct'] === 'boolean'
  );
}

export function isQuizQuestion(value: unknown): value is QuizQuestionResponse {
  return (
    isRecord(value) &&
    isInteger(value['id'], 1) &&
    isInteger(value['version'], 0) &&
    (value['sourceType'] === 'EXAMPLE' || value['sourceType'] === 'CUSTOM') &&
    (value['status'] === 'DRAFT' ||
      value['status'] === 'PUBLISHED' ||
      value['status'] === 'ARCHIVED') &&
    (value['exampleId'] === undefined || isInteger(value['exampleId'], 1)) &&
    (value['vocabularyId'] === undefined || isInteger(value['vocabularyId'], 1)) &&
    (value['sentenceReading'] === undefined || typeof value['sentenceReading'] === 'string') &&
    isInteger(value['targetStart'], 0) &&
    isInteger(value['targetLength'], 1) &&
    typeof value['targetReading'] === 'string' &&
    (value['explanationVi'] === undefined || typeof value['explanationVi'] === 'string') &&
    (value['explanationEn'] === undefined || typeof value['explanationEn'] === 'string') &&
    typeof value['sourceInvalidated'] === 'boolean' &&
    typeof value['eligibleForNewGames'] === 'boolean' &&
    isIds(value['levelIds']) &&
    isIds(value['lessonIds']) &&
    Array.isArray(value['options']) &&
    value['options'].every(isOption) &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}

export function isQuizQuestionList(value: unknown): value is QuizQuestionListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(isQuizQuestion) &&
    isInteger(value['page'], 0) &&
    isInteger(value['size'], 1) &&
    isInteger(value['totalElements'], 0) &&
    isInteger(value['totalPages'], 0)
  );
}
