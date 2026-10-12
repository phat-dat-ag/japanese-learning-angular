import { isRecord } from '../../../core/api/api-response.model';
import { isQuestion, QuizPlayerQuestion } from './quiz-gameplay.model';

export interface QuizHistorySummary {
  readonly sessionId: number;
  readonly status: 'COMPLETED';
  readonly levelId: number | null;
  readonly lessonId: number | null;
  readonly completedAt: string;
  readonly questionCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly score: number;
}

export interface QuizHistoryPage {
  readonly items: readonly QuizHistorySummary[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface QuizHistoryQuestion extends QuizPlayerQuestion {
  readonly selectedOptionId: number;
  readonly correctOptionId: number;
  readonly correct: boolean;
  readonly explanationVi: string | null;
  readonly explanationEn: string | null;
  readonly answeredAt: string;
}

export interface QuizHistoryDetail {
  readonly session: QuizHistorySummary;
  readonly questions: readonly QuizHistoryQuestion[];
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function nullableId(value: unknown): boolean {
  return value === null || integer(value, 1);
}

function nullableText(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isSummary(value: unknown): value is QuizHistorySummary {
  return (
    isRecord(value) &&
    integer(value['sessionId'], 1) &&
    value['status'] === 'COMPLETED' &&
    nullableId(value['levelId']) &&
    nullableId(value['lessonId']) &&
    typeof value['completedAt'] === 'string' &&
    integer(value['questionCount'], 1) &&
    integer(value['correctCount']) &&
    integer(value['incorrectCount']) &&
    integer(value['score'])
  );
}

function isReviewQuestion(value: unknown): value is QuizHistoryQuestion {
  return (
    isRecord(value) &&
    isQuestion(value) &&
    integer(value['selectedOptionId'], 1) &&
    integer(value['correctOptionId'], 1) &&
    value.options.some((option) => option.id === value['selectedOptionId']) &&
    value.options.some((option) => option.id === value['correctOptionId']) &&
    typeof value['correct'] === 'boolean' &&
    nullableText(value['explanationVi']) &&
    nullableText(value['explanationEn']) &&
    typeof value['answeredAt'] === 'string'
  );
}

export function isQuizHistoryPage(value: unknown): value is QuizHistoryPage {
  return (
    isRecord(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(isSummary) &&
    integer(value['page']) &&
    integer(value['size'], 1) &&
    value['size'] <= 100 &&
    integer(value['totalElements']) &&
    integer(value['totalPages'])
  );
}

export function isQuizHistoryDetail(value: unknown): value is QuizHistoryDetail {
  return (
    isRecord(value) &&
    isSummary(value['session']) &&
    Array.isArray(value['questions']) &&
    value['questions'].every(isReviewQuestion)
  );
}
