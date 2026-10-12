import {
  QuizHistoryDetail,
  QuizHistoryPage,
  QuizHistorySummary,
} from '../models/quiz-history.model';
import { QuizProgress, QuizProgressBreakdown } from '../models/quiz-progress.model';
import { question } from './quiz-gameplay.fixture';

export const historySummary: QuizHistorySummary = {
  sessionId: 42,
  status: 'COMPLETED',
  levelId: null,
  lessonId: null,
  completedAt: '2026-10-12T10:15:30.123456',
  questionCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  score: 1,
};
export const historyPage: QuizHistoryPage = {
  items: [historySummary],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};
export const historyDetail: QuizHistoryDetail = {
  session: historySummary,
  questions: [
    {
      ...question,
      selectedOptionId: 402,
      correctOptionId: 401,
      correct: false,
      explanationVi: 'Trường học',
      explanationEn: 'School',
      answeredAt: '2026-10-12T10:15:00',
    },
    {
      ...question,
      sessionQuestionId: 102,
      questionNumber: 1,
      selectedOptionId: 401,
      correctOptionId: 401,
      correct: true,
      explanationVi: null,
      explanationEn: null,
      answeredAt: '2026-10-12T10:15:15',
    },
  ],
};
export const progress: QuizProgress = {
  completedSessions: 2,
  answeredCount: 6,
  correctCount: 4,
  incorrectCount: 2,
  accuracyPercentage: 66.67,
  bestScore: 3,
  averageScore: 2,
  latestCompletedAt: '2026-10-12T10:15:30',
};
const counts = {
  completedSessions: 1,
  answeredCount: 3,
  correctCount: 2,
  incorrectCount: 1,
  accuracyPercentage: 66.67,
};
export const breakdown: QuizProgressBreakdown = {
  levels: [
    { ...counts, classification: 'ASSIGNED', levelId: 1, lessonId: null },
    { ...counts, classification: 'ASSIGNED', levelId: 2, lessonId: null },
    { ...counts, classification: 'UNASSIGNED', levelId: null, lessonId: null },
    { ...counts, classification: 'UNKNOWN', levelId: null, lessonId: null },
  ],
  lessons: [
    { ...counts, classification: 'ASSIGNED', levelId: 1, lessonId: 10 },
    { ...counts, classification: 'ASSIGNED', levelId: 2, lessonId: 10 },
    { ...counts, classification: 'UNASSIGNED', levelId: null, lessonId: null },
    { ...counts, classification: 'UNKNOWN', levelId: null, lessonId: null },
  ],
};
