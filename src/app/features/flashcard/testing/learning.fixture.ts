import { LearningStatistics, ProgressState, SessionDetail } from '../models/learning.model';

export const learningMeta = {
  timestamp: '2026-10-25T00:00:00Z',
  traceId: 'test',
  correlationId: 'test',
};
export const unseenProgress: ProgressState = {
  status: 'NEW',
  successfulRepetitionCount: 0,
  lapseCount: 0,
  intervalSeconds: 0,
  easeFactor: 2.5,
  version: 0,
};
export const sessionFixture: SessionDetail = {
  sessionId: 9,
  lessonId: 12,
  mode: 'NEW_AND_DUE',
  status: 'IN_PROGRESS',
  itemCount: 1,
  completedCount: 0,
  currentPosition: 0,
  createdAt: learningMeta.timestamp,
  items: [{ itemId: 21, vocabularyId: 7, position: 0, progress: unseenProgress }],
};
export const statisticsFixture: LearningStatistics = {
  totalVocabularyCount: 2,
  newCount: 2,
  learningCount: 0,
  reviewCount: 0,
  masteredCount: 0,
  dueCount: 0,
  studiedCount: 1,
  totalReviewAttempts: 1,
  rememberedCount: 1,
  forgottenCount: 0,
  scheduledReviewAttempts: 0,
  practiceReviewAttempts: 1,
  studiedPercentage: 50,
  masteryPercentage: 0,
};
export const learningSuccess = <T>(data: T) => ({ success: true, data, meta: learningMeta });
