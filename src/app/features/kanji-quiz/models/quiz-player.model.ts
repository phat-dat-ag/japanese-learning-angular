import { isRecord } from '../../../core/api/api-response.model';

export interface QuizGameLevel {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly questionCount: number;
}

export interface QuizGameLesson {
  readonly id: number;
  readonly levelId: number;
  readonly lessonNumber: number;
  readonly title: string;
  readonly questionCount: number;
}

export interface QuizGameConfig {
  readonly totalQuestions: number;
  readonly maxQuestionCount: number;
  readonly levels: readonly QuizGameLevel[];
  readonly lessons: readonly QuizGameLesson[];
}

export interface QuizSessionCreateRequest {
  readonly levelId?: number;
  readonly lessonId?: number;
  readonly questionCount: number;
}

export interface QuizSessionCreated {
  readonly sessionId: number;
  readonly status: 'IN_PROGRESS';
  readonly questionCount: number;
  readonly createdAt: string;
}

function integer(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isLevel(value: unknown): value is QuizGameLevel {
  return (
    isRecord(value) &&
    integer(value['id'], 1) &&
    typeof value['code'] === 'string' &&
    typeof value['name'] === 'string' &&
    integer(value['questionCount'], 1)
  );
}

function isLesson(value: unknown): value is QuizGameLesson {
  return (
    isRecord(value) &&
    integer(value['id'], 1) &&
    integer(value['levelId'], 1) &&
    integer(value['lessonNumber'], 1) &&
    typeof value['title'] === 'string' &&
    integer(value['questionCount'], 1)
  );
}

export function isQuizGameConfig(value: unknown): value is QuizGameConfig {
  return (
    isRecord(value) &&
    integer(value['totalQuestions'], 0) &&
    integer(value['maxQuestionCount'], 1) &&
    value['maxQuestionCount'] <= 100 &&
    Array.isArray(value['levels']) &&
    value['levels'].every(isLevel) &&
    Array.isArray(value['lessons']) &&
    value['lessons'].every(isLesson)
  );
}

export function isQuizSessionCreated(value: unknown): value is QuizSessionCreated {
  return (
    isRecord(value) &&
    integer(value['sessionId'], 1) &&
    value['status'] === 'IN_PROGRESS' &&
    integer(value['questionCount'], 1) &&
    value['questionCount'] <= 100 &&
    typeof value['createdAt'] === 'string' &&
    value['createdAt'].length > 0
  );
}
