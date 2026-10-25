import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FlashcardLearningService } from './flashcard-learning.service';
import { FlashcardSessionService } from './flashcard-session.service';
import {
  learningSuccess,
  sessionFixture,
  statisticsFixture,
  unseenProgress,
} from '../testing/learning.fixture';

describe('Flashcard OpenAPI HTTP contracts', () => {
  let http: HttpTestingController;
  let learning: FlashcardLearningService;
  let sessions: FlashcardSessionService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    learning = TestBed.inject(FlashcardLearningService);
    sessions = TestBed.inject(FlashcardSessionService);
  });
  afterEach(() => http.verify());
  it('creates using database lessonId and accepts the normal empty outcome', () => {
    const next = vi.fn();
    sessions.create({ lessonId: 12, mode: 'DUE', cardLimit: 20, shuffle: false }).subscribe(next);
    const req = http.expectOne('/api/v1/flashcards/sessions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ lessonId: 12, mode: 'DUE', cardLimit: 20, shuffle: false });
    req.flush(learningSuccess({ outcome: 'NO_ELIGIBLE_CARDS', eligibleCount: 0 }));
    expect(next).toHaveBeenCalled();
  });
  it('sends an unchanged review identity on exact retries and preserves metadata', () => {
    const body = { rating: 'GOOD' as const, expectedProgressVersion: 0 };
    for (let attempt = 0; attempt < 2; attempt++) {
      const next = vi.fn();
      sessions.review(9, 21, body).subscribe(next);
      const req = http.expectOne('/api/v1/flashcards/sessions/9/items/21/review');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(
        learningSuccess({
          reviewId: 3,
          sessionItemId: 21,
          vocabularyId: 7,
          rating: 'GOOD',
          scheduling: true,
          progress: { ...unseenProgress, version: 1 },
          reviewedAt: sessionFixture.createdAt,
        }),
      );
      expect(next.mock.calls[0][0].meta.traceId).toBe('test');
    }
  });
  it('uses bodyless bookmark PUT/DELETE and lifecycle POSTs', () => {
    for (const bookmarked of [true, false]) {
      learning.bookmark(7, bookmarked).subscribe();
      const req = http.expectOne('/api/v1/flashcards/7/bookmark');
      expect(req.request.method).toBe(bookmarked ? 'PUT' : 'DELETE');
      expect(req.request.body).toBeNull();
      req.flush(learningSuccess({ vocabularyId: 7, bookmarked }));
    }
    sessions.abandon(9).subscribe();
    const abandon = http.expectOne('/api/v1/flashcards/sessions/9/abandon');
    expect(abandon.request.body).toBeNull();
    abandon.flush(
      learningSuccess({
        ...sessionFixture,
        status: 'ABANDONED',
        abandonedAt: sessionFixture.createdAt,
      }),
    );
    sessions.finish(9).subscribe();
    const finish = http.expectOne('/api/v1/flashcards/sessions/9/finish');
    expect(finish.request.body).toBeNull();
    finish.flush(
      learningSuccess({
        ...sessionFixture,
        status: 'COMPLETED',
        completedCount: 1,
        currentPosition: 1,
        completedAt: sessionFixture.createdAt,
        items: sessionFixture.items.map((i) => ({ ...i, completedAt: sessionFixture.createdAt })),
      }),
    );
  });
  it('uses intersected filters and new items pages', () => {
    learning.statistics({ level: 'n5', lessonId: 12 }).subscribe();
    http
      .expectOne('/api/v1/flashcards/statistics?level=N5&lessonId=12')
      .flush(learningSuccess(statisticsFixture));
    for (const collection of ['bookmarks', 'reviews/due', 'reviews/forgotten'] as const) {
      learning.collection(collection, { lessonId: 12 }, 1).subscribe();
      http
        .expectOne(`/api/v1/flashcards/${collection}?lessonId=12&page=1&size=20`)
        .flush(learningSuccess({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 }));
    }
    sessions.list(12).subscribe();
    const { items, ...summary } = sessionFixture;
    http
      .expectOne('/api/v1/flashcards/sessions?status=IN_PROGRESS&page=0&size=20&lessonId=12')
      .flush(
        learningSuccess({ items: [summary], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
      );
    sessions.get(9).subscribe();
    http.expectOne('/api/v1/flashcards/sessions/9').flush(learningSuccess(sessionFixture));
  });
  it.each(['FLASHCARD_NOT_DUE', 'FLASHCARD_CONFLICT'])('preserves %s without retrying', (code) => {
    const error = vi.fn();
    sessions.review(9, 21, { rating: 'AGAIN', expectedProgressVersion: 0 }).subscribe({ error });
    http.expectOne('/api/v1/flashcards/sessions/9/items/21/review').flush(
      {
        success: false,
        error: { code, message: 'private', details: [] },
        meta: learningSuccess(null).meta,
      },
      { status: 409, statusText: 'Conflict' },
    );
    expect(error.mock.calls[0][0].code).toBe(code);
    expect(error.mock.calls[0][0].status).toBe(409);
  });
});
