import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { ApiError } from '../../../../core/api/api-error';
import {
  isVocabularyCoreResult,
  VocabularyCore,
  VocabularyCoreResult,
  VocabularyCoreUpdateRequest,
} from '../models/vocabulary-core.model';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import { FlashcardService } from '../../../flashcard/services/flashcard.service';
import { VocabularyPage, VocabularyQuery } from '../models/vocabulary.model';

@Injectable({ providedIn: 'root' })
export class VocabularyService {
  private readonly api = inject(ApiClient);
  private readonly flashcards = inject(FlashcardService);

  getVocabularyList(query: VocabularyQuery): Observable<ApiSuccess<VocabularyPage>> {
    return this.flashcards.getFlashcardPage(query).pipe(
      map((response) => {
        const { flashcardItems, ...pagination } = response.data;
        return { ...response, data: { ...pagination, items: flashcardItems } };
      }),
    );
  }

  getVocabularyDetail(vocabularyId: number): Observable<ApiSuccess<VocabularyCore>> {
    return this.flashcards.getFlashcard(vocabularyId).pipe(
      map((response) => {
        if (response.data.vocabulary.id !== vocabularyId)
          throw ApiError.invalidResponse(200, response.meta);
        return { ...response, data: response.data.vocabulary };
      }),
    );
  }

  updateVocabularyCore(
    vocabularyId: number,
    request: VocabularyCoreUpdateRequest,
  ): Observable<ApiSuccess<VocabularyCoreResult>> {
    return this.api
      .put(
        `v1/admin/vocabularies/${vocabularyId}`,
        { word: request.word, normalizedWord: request.normalizedWord },
        isVocabularyCoreResult,
      )
      .pipe(
        map((response) => {
          if (response.data.vocabularyId !== vocabularyId)
            throw ApiError.invalidResponse(200, response.meta);
          return response;
        }),
      );
  }
}
