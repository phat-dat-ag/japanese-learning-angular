import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client.service';
import {
  isBookmark,
  isPersonalCard,
  isPersonalDetail,
  isStatistics,
  LearningScope,
  pageGuard,
} from '../models/learning.model';

export type LearningCollection = 'bookmarks' | 'reviews/due' | 'reviews/forgotten';

@Injectable({ providedIn: 'root' })
export class FlashcardLearningService {
  private readonly api = inject(ApiClient);

  detail(id: number) {
    return this.api.get(`v1/flashcards/${id}?includeLearning=true`, isPersonalDetail);
  }

  statistics(scope: LearningScope = {}) {
    return this.api.get(`v1/flashcards/statistics?${this.scopeParams(scope)}`, isStatistics);
  }

  collection(collection: LearningCollection, scope: LearningScope = {}, page = 0) {
    const params = this.scopeParams(scope);
    params.set('page', String(page));
    params.set('size', '20');
    return this.api.get(`v1/flashcards/${collection}?${params}`, pageGuard(isPersonalCard));
  }

  bookmark(vocabularyId: number, bookmarked: boolean) {
    const path = `v1/flashcards/${vocabularyId}/bookmark`;
    return bookmarked
      ? this.api.put(path, undefined, isBookmark)
      : this.api.delete(path, isBookmark);
  }

  private scopeParams(scope: LearningScope): URLSearchParams {
    const params = new URLSearchParams();
    if (scope.level) params.set('level', scope.level.toUpperCase());
    if (scope.lessonId !== undefined) params.set('lessonId', String(scope.lessonId));
    return params;
  }
}
