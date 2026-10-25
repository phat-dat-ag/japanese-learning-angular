import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { SessionPlayerState } from './session-player-state';
import { FlashcardSessionService } from './flashcard-session.service';
import { FlashcardLearningService } from './flashcard-learning.service';
import { learningSuccess, sessionFixture, unseenProgress } from '../testing/learning.fixture';

describe('Session player review recovery', () => {
  let state: SessionPlayerState;
  const api = { get: vi.fn(), review: vi.fn(), abandon: vi.fn() };
  const learning = { detail: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.get.mockReturnValue(of(learningSuccess(sessionFixture)));
    learning.detail.mockReturnValue(
      of(learningSuccess({ vocabulary: { id: 7 }, progress: unseenProgress, bookmarked: false })),
    );
    TestBed.configureTestingModule({
      providers: [
        SessionPlayerState,
        { provide: FlashcardSessionService, useValue: api },
        { provide: FlashcardLearningService, useValue: learning },
      ],
    });
    state = TestBed.inject(SessionPlayerState);
    await state.open(9);
    state.revealed.set(true);
  });
  it('blocks double submissions and keeps the exact request after uncertain delivery', async () => {
    const response = new Subject();
    api.review.mockReturnValue(response);
    const first = state.rate('GOOD');
    await state.rate('EASY');
    expect(api.review).toHaveBeenCalledTimes(1);
    response.error(new ApiError('NETWORK_ERROR', '', 0));
    await first;
    expect(state.canRate()).toBe(false);
    api.review.mockReturnValue(of(learningSuccess({})));
    await state.retryReview();
    expect(api.review.mock.calls[1]).toEqual([
      9,
      21,
      { rating: 'GOOD', expectedProgressVersion: 0 },
    ]);
  });
  it.each(['FLASHCARD_NOT_DUE', 'FLASHCARD_CONFLICT'])(
    'requires refresh after %s without automatic retry',
    async (code) => {
      api.review.mockReturnValue(throwError(() => new ApiError(code, '', 409)));
      await state.rate('HARD');
      expect(api.review).toHaveBeenCalledTimes(1);
      expect(state.pending()).toBeNull();
      expect(state.needsRefresh()).toBe(true);
      await state.rate('GOOD');
      expect(api.review).toHaveBeenCalledTimes(1);
    },
  );
  it('reconciles a lost final response from persisted completion', async () => {
    api.review.mockReturnValue(throwError(() => new ApiError('REQUEST_TIMEOUT', '', 0)));
    await state.rate('GOOD');
    api.get.mockReturnValue(
      of(
        learningSuccess({
          ...sessionFixture,
          status: 'COMPLETED',
          currentPosition: 1,
          completedCount: 1,
          completedAt: sessionFixture.createdAt,
          items: sessionFixture.items.map((i) => ({ ...i, completedAt: sessionFixture.createdAt })),
        }),
      ),
    );
    await state.refresh();
    expect(state.pending()).toBeNull();
    expect(state.session()?.status).toBe('COMPLETED');
    expect(state.card()).toBeNull();
  });
  it('does not use a historical review response as current progress', async () => {
    api.review.mockReturnValue(
      of(learningSuccess({ progress: { ...unseenProgress, version: 1 } })),
    );
    api.get.mockReturnValue(
      of(
        learningSuccess({
          ...sessionFixture,
          items: sessionFixture.items.map((i) => ({
            ...i,
            progress: { ...unseenProgress, version: 3 },
          })),
        }),
      ),
    );
    await state.rate('GOOD');
    expect(state.item()?.progress.version).toBe(3);
  });
  it('preserves returned COMPLETED status if abandonment races with the last review', async () => {
    api.abandon.mockReturnValue(of(learningSuccess({ ...sessionFixture, status: 'COMPLETED' })));
    await state.abandon();
    expect(state.session()?.status).toBe('COMPLETED');
    expect(state.canRate()).toBe(false);
  });
  it('ignores a late response after authentication changes', async () => {
    const response = new Subject();
    api.review.mockReturnValue(response);
    const submission = state.rate('GOOD');
    TestBed.inject(AuthSession).clear();
    response.next(learningSuccess({}));
    response.complete();
    await submission;
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
