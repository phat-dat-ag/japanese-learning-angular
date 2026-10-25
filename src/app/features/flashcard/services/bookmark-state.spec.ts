import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { learningSuccess } from '../testing/learning.fixture';
import { BookmarkState } from './bookmark-state';
import { FlashcardLearningService } from './flashcard-learning.service';

describe('Bookmark mutation state', () => {
  const api = { bookmark: vi.fn() };
  let state: BookmarkState;
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [BookmarkState, { provide: FlashcardLearningService, useValue: api }],
    });
    state = TestBed.inject(BookmarkState);
  });
  it('blocks overlapping toggles and applies only confirmed server state', async () => {
    const response = new Subject();
    api.bookmark.mockReturnValue(response);
    const first = state.save(7, true);
    expect(await state.save(7, false)).toBe(false);
    expect(state.values().has(7)).toBe(false);
    response.next(learningSuccess({ vocabularyId: 7, bookmarked: true }));
    response.complete();
    expect(await first).toBe(true);
    expect(state.values().get(7)).toBe(true);
    expect(api.bookmark).toHaveBeenCalledTimes(1);
  });
  it('preserves current state and shows a safe error after failure', async () => {
    state.values.set(new Map([[7, true]]));
    api.bookmark.mockReturnValue(
      throwError(() => new ApiError('INTERNAL_ERROR', 'private diagnostics', 500)),
    );
    expect(await state.save(7, false)).toBe(false);
    expect(state.values().get(7)).toBe(true);
    expect(state.error()).not.toContain('private diagnostics');
    expect(state.saving()).toBeNull();
  });
  it('discards late responses after a different authentication revision', async () => {
    const response = new Subject();
    api.bookmark.mockReturnValue(response);
    const first = state.save(7, true);
    TestBed.inject(AuthSession).clear();
    response.next(learningSuccess({ vocabularyId: 7, bookmarked: true }));
    response.complete();
    expect(await first).toBe(false);
    expect(state.values().size).toBe(0);
  });
});
