import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { FlashcardService } from '../../../flashcard/services/flashcard.service';
import { VocabularyPage, VocabularyQuery } from '../models/vocabulary.model';

@Injectable({ providedIn: 'root' })
export class VocabularyService {
  private readonly flashcards = inject(FlashcardService);

  getVocabularyList(query: VocabularyQuery): Observable<ApiSuccess<VocabularyPage>> {
    return this.flashcards.getFlashcardPage(query).pipe(
      map((response) => {
        const { flashcardItems, ...pagination } = response.data;
        return { ...response, data: { ...pagination, items: flashcardItems } };
      }),
    );
  }
}
