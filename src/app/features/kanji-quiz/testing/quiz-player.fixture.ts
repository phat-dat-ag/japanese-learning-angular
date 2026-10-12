import { QuizGameConfig, QuizSessionCreated } from '../models/quiz-player.model';

export const meta = {
  timestamp: '2026-10-12T00:00:00Z',
  traceId: 'trace',
  correlationId: 'correlation',
};
export const config: QuizGameConfig = {
  totalQuestions: 12,
  maxQuestionCount: 100,
  levels: [
    { id: 1, code: 'N5', name: 'JLPT N5', questionCount: 8 },
    { id: 2, code: 'N4', name: 'JLPT N4', questionCount: 4 },
  ],
  lessons: [
    { id: 10, levelId: 1, lessonNumber: 1, title: 'First lesson', questionCount: 3 },
    { id: 20, levelId: 2, lessonNumber: 1, title: 'Second lesson', questionCount: 4 },
  ],
};
export const created: QuizSessionCreated = {
  sessionId: 42,
  status: 'IN_PROGRESS',
  questionCount: 1,
  createdAt: '2026-10-12T00:00:00',
};
export function success<T>(data: T) {
  return { success: true as const, data, meta };
}
