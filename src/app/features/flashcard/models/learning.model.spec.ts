import {
  isProgress,
  isSessionCreated,
  isSessionDetail,
  isSessionSummary,
  isStatistics,
  pageGuard,
  isPersonalCard,
} from './learning.model';
import { sessionFixture, statisticsFixture, unseenProgress } from '../testing/learning.fixture';

describe('Flashcard learning wire contracts', () => {
  it('accepts omitted and null optional timestamps', () => {
    expect(isProgress(unseenProgress)).toBe(true);
    expect(isProgress({ ...unseenProgress, nextReviewAt: null })).toBe(true);
    expect(isSessionDetail(sessionFixture)).toBe(true);
    const { items, ...summary } = sessionFixture;
    expect(isSessionSummary(summary)).toBe(true);
    expect(isSessionDetail(summary)).toBe(false);
  });
  it('discriminates normal empty creation from successful creation', () => {
    expect(isSessionCreated({ outcome: 'NO_ELIGIBLE_CARDS', eligibleCount: 0 })).toBe(true);
    expect(
      isSessionCreated({ outcome: 'CREATED', eligibleCount: 1, session: sessionFixture }),
    ).toBe(true);
    expect(isSessionCreated({ outcome: 'CREATED', eligibleCount: 1 })).toBe(false);
    expect(isSessionCreated({ outcome: 'NO_ELIGIBLE_CARDS', eligibleCount: 1 })).toBe(false);
  });
  it('rejects invalid versions, enums, dates and inconsistent completion', () => {
    for (const version of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '0']) {
      expect(isProgress({ ...unseenProgress, version })).toBe(false);
    }
    expect(isProgress({ ...unseenProgress, status: 'STUDIED' })).toBe(false);
    expect(isProgress({ ...unseenProgress, nextReviewAt: 'tomorrow' })).toBe(false);
    expect(isSessionDetail({ ...sessionFixture, completedCount: 1 })).toBe(false);
    expect(isSessionDetail({ ...sessionFixture, status: 'ABANDONED' })).toBe(false);
    expect(
      isSessionDetail({
        ...sessionFixture,
        status: 'ABANDONED',
        abandonedAt: sessionFixture.createdAt,
      }),
    ).toBe(true);
  });
  it('keeps practice coverage distinct from SRS status and accepts empty collections', () => {
    expect(isStatistics(statisticsFixture)).toBe(true);
    expect(isStatistics({ ...statisticsFixture, masteryPercentage: 101 })).toBe(false);
    expect(
      pageGuard(isPersonalCard)({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    ).toBe(true);
    expect(
      pageGuard(isPersonalCard)({
        flashcardItems: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      }),
    ).toBe(false);
  });
});
