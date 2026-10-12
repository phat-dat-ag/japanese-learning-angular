import { isRecord } from '../../../core/api/api-response.model';

export type QuizSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface QuizSession {
  readonly sessionId: number;
  readonly status: QuizSessionStatus;
  readonly questionCount: number;
  readonly answeredCount: number;
  readonly score: number;
}

export interface QuizPlayerOption {
  readonly id: number;
  readonly text: string;
}

export interface QuizPlayerQuestion {
  readonly sessionQuestionId: number;
  readonly questionNumber: number;
  readonly sentenceReading: string;
  /** Unicode code-point offsets, not UTF-16 indices. */
  readonly targetStart: number;
  readonly targetLength: number;
  readonly options: readonly QuizPlayerOption[];
}

export interface QuizNextQuestion {
  readonly sessionId: number;
  readonly status: QuizSessionStatus;
  readonly question: QuizPlayerQuestion | null;
}

export interface QuizAnswerRequest {
  readonly sessionQuestionId: number;
  readonly selectedOptionId: number;
}

export interface QuizAnswer {
  readonly sessionQuestionId: number;
  readonly correct: boolean;
  readonly correctOptionId: number;
  readonly explanationVi?: string | null;
  readonly explanationEn?: string | null;
  readonly score: number;
  readonly answeredCount: number;
  readonly remainingCount: number;
}

export interface QuizCompletion {
  readonly sessionId: number;
  readonly status: 'COMPLETED';
  readonly questionCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly score: number;
  readonly completedAt: string;
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isStatus(value: unknown): value is QuizSessionStatus {
  return value === 'IN_PROGRESS' || value === 'COMPLETED' || value === 'ABANDONED';
}

export function isQuizSession(value: unknown): value is QuizSession {
  return (
    isRecord(value) &&
    integer(value['sessionId'], 1) &&
    isStatus(value['status']) &&
    integer(value['questionCount'], 1) &&
    integer(value['answeredCount']) &&
    value['answeredCount'] <= value['questionCount'] &&
    integer(value['score']) &&
    value['score'] <= value['answeredCount']
  );
}

function isOption(value: unknown): value is QuizPlayerOption {
  return isRecord(value) && integer(value['id'], 1) && typeof value['text'] === 'string';
}

function isQuestion(value: unknown): value is QuizPlayerQuestion {
  return (
    isRecord(value) &&
    integer(value['sessionQuestionId'], 1) &&
    integer(value['questionNumber']) &&
    typeof value['sentenceReading'] === 'string' &&
    integer(value['targetStart']) &&
    integer(value['targetLength'], 1) &&
    value['targetStart'] + value['targetLength'] <= Array.from(value['sentenceReading']).length &&
    Array.isArray(value['options']) &&
    value['options'].length === 4 &&
    value['options'].every(isOption) &&
    new Set(value['options'].map((option) => option.id)).size === 4
  );
}

export function isQuizNextQuestion(value: unknown): value is QuizNextQuestion {
  return (
    isRecord(value) &&
    integer(value['sessionId'], 1) &&
    isStatus(value['status']) &&
    (value['question'] === null ||
      (value['status'] === 'IN_PROGRESS' && isQuestion(value['question'])))
  );
}

function optionalText(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

export function isQuizAnswer(value: unknown): value is QuizAnswer {
  return (
    isRecord(value) &&
    integer(value['sessionQuestionId'], 1) &&
    typeof value['correct'] === 'boolean' &&
    integer(value['correctOptionId'], 1) &&
    optionalText(value['explanationVi']) &&
    optionalText(value['explanationEn']) &&
    integer(value['score']) &&
    integer(value['answeredCount'], 1) &&
    value['score'] <= value['answeredCount'] &&
    integer(value['remainingCount'])
  );
}

export function isQuizCompletion(value: unknown): value is QuizCompletion {
  return (
    isRecord(value) &&
    integer(value['sessionId'], 1) &&
    value['status'] === 'COMPLETED' &&
    integer(value['questionCount'], 1) &&
    integer(value['correctCount']) &&
    integer(value['incorrectCount']) &&
    value['correctCount'] + value['incorrectCount'] === value['questionCount'] &&
    value['score'] === value['correctCount'] &&
    typeof value['completedAt'] === 'string' &&
    value['completedAt'].length > 0
  );
}
