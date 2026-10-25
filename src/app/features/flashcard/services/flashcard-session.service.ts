import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client.service';
import {
  isReviewResponse,
  isSessionCreated,
  isSessionDetail,
  isSessionSummary,
  pageGuard,
  ReviewRequest,
  SessionCreateRequest,
  SessionStatus,
} from '../models/learning.model';

@Injectable({ providedIn: 'root' })
export class FlashcardSessionService {
  private readonly api = inject(ApiClient);
  create(request: SessionCreateRequest) {
    return this.api.post('v1/flashcards/sessions', request, isSessionCreated);
  }
  list(lessonId?: number, status: SessionStatus = 'IN_PROGRESS', page = 0) {
    const params = new URLSearchParams({ status, page: String(page), size: '20' });
    if (lessonId !== undefined) params.set('lessonId', String(lessonId));
    return this.api.get(`v1/flashcards/sessions?${params}`, pageGuard(isSessionSummary));
  }
  get(id: number) {
    return this.api.get(`v1/flashcards/sessions/${id}`, isSessionDetail);
  }
  review(id: number, itemId: number, request: ReviewRequest) {
    return this.api.put(
      `v1/flashcards/sessions/${id}/items/${itemId}/review`,
      request,
      isReviewResponse,
    );
  }
  finish(id: number) {
    return this.api.post(`v1/flashcards/sessions/${id}/finish`, undefined, isSessionDetail);
  }
  abandon(id: number) {
    return this.api.post(`v1/flashcards/sessions/${id}/abandon`, undefined, isSessionDetail);
  }
}
