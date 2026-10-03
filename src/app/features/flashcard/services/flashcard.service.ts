import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client.service';
import { ApiSuccess } from '../../../core/api/api-response.model';
import { FlashcardPage, isFlashcardPage } from '../models/flashcard-page.model';
import { FlashcardListQuery } from '../models/flashcard-list-query.model';
import { Flashcard, isFlashcard } from '../models/flashcard.model';

@Injectable({ providedIn: 'root' })
export class FlashcardService {
  private readonly api = inject(ApiClient);

  getFlashcards(lessonId: number, level: string, page = 0): Observable<ApiSuccess<FlashcardPage>> {
    return this.getFlashcardPage({ lesson: lessonId, level, page, size: 20 });
  }

  getFlashcardPage(query: FlashcardListQuery): Observable<ApiSuccess<FlashcardPage>> {
    const params = new URLSearchParams();

    if (query.lesson !== undefined) params.set('lesson', String(query.lesson));

    if (query.level) params.set('level', query.level.toUpperCase());

    params.set('page', String(query.page));
    params.set('size', String(query.size));

    return this.api.get(`v1/flashcards?${params}`, isFlashcardPage);
  }

  getLessonFlashcardIds(lessonId: number, level: string): Observable<readonly number[]> {
    return this.getFlashcards(lessonId, level).pipe(
      expand((response) =>
        response.data.page + 1 < response.data.totalPages
          ? this.getFlashcards(lessonId, level, response.data.page + 1)
          : EMPTY,
      ),

      reduce(
        (ids: number[], response) => [
          ...ids,
          ...response.data.flashcardItems.map((card) => card.id),
        ],
        [],
      ),

      map((ids) => [...new Set(ids)]),
    );
  }

  getFlashcard(flashcardId: number): Observable<ApiSuccess<Flashcard>> {
    return this.api.get(`v1/flashcards/${flashcardId}`, isFlashcard);
  }
}
