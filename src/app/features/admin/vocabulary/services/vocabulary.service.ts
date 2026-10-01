import {
  VocabularyExampleUpdateRequest,
  KanjiUpdateRequest,
  KanjiReadingUpdateRequest,
} from '../models/vocabulary-content.model';
import {
  identityResult,
  VocabularyPitchAccentUpdateRequest,
  AssignmentOrderUpdateRequest,
  LevelAssignmentAddRequest,
  LessonAssignmentAddRequest,
  PartOfSpeechAssignmentAddRequest,
} from '../models/vocabulary-metadata.model';
import { VocabularyDetailData } from '../models/vocabulary-detail.model';
import {
  isReadingResults,
  isMeaningResults,
  VocabularyReadingUpdateRequest,
  VocabularyReadingResult,
  VocabularyMeaningUpdateRequest,
  VocabularyMeaningResult,
} from '../models/vocabulary-children.model';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { ApiError } from '../../../../core/api/api-error';
import {
  isVocabularyCoreResult,
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

  getVocabularyDetail(vocabularyId: number): Observable<ApiSuccess<VocabularyDetailData>> {
    return this.flashcards.getFlashcard(vocabularyId).pipe(
      map((response) => {
        if (response.data.vocabulary.id !== vocabularyId)
          throw ApiError.invalidResponse(200, response.meta);
        return {
          ...response,
          data: {
            ...response.data.vocabulary,
            readings: response.data.readings,
            meanings: response.data.meanings,
            pitchAccents: response.data.readings.flatMap((reading) =>
              reading.pitchAccentDetails.map((accent) => ({
                ...accent,
                readingId: reading.readingId,
                reading: reading.reading,
              })),
            ),
            levels: response.data.levels,
            lessons: response.data.lessons,
            partsOfSpeech: response.data.partsOfSpeech,
            examples: response.data.examples,
            kanji: response.data.kanji,
          },
        };
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

  addReadings(
    vocabularyId: number,
    requests: readonly VocabularyReadingUpdateRequest[],
  ): Observable<ApiSuccess<readonly VocabularyReadingResult[]>> {
    return this.api
      .post(
        `v1/admin/vocabularies/${vocabularyId}/readings`,
        requests.map(({ reading, isPrimary, displayOrder }) => ({
          reading,
          isPrimary,
          displayOrder,
        })),
        isReadingResults,
      )
      .pipe(
        map((response) => {
          if (
            response.data.length !== requests.length ||
            new Set(response.data.map((item) => item.readingId)).size !== response.data.length
          )
            throw ApiError.invalidResponse(200, response.meta);
          return response;
        }),
      );
  }

  addMeanings(
    vocabularyId: number,
    requests: readonly VocabularyMeaningUpdateRequest[],
  ): Observable<ApiSuccess<readonly VocabularyMeaningResult[]>> {
    return this.api
      .post(
        `v1/admin/vocabularies/${vocabularyId}/meanings`,
        requests.map(({ language, meaning, isPrimary, displayOrder }) => ({
          language,
          meaning,
          isPrimary,
          displayOrder,
        })),
        isMeaningResults,
      )
      .pipe(
        map((response) => {
          if (
            response.data.length !== requests.length ||
            new Set(response.data.map((item) => item.meaningId)).size !== response.data.length
          )
            throw ApiError.invalidResponse(200, response.meta);
          return response;
        }),
      );
  }
  updateReading(
    vocabularyId: number,
    readingId: number,
    request: VocabularyReadingUpdateRequest,
  ): Observable<ApiSuccess<VocabularyReadingResult>> {
    return this.api
      .put(
        `v1/admin/vocabularies/${vocabularyId}/readings/${readingId}`,
        {
          reading: request.reading,
          isPrimary: request.isPrimary,
          displayOrder: request.displayOrder,
        },
        (value): value is VocabularyReadingResult => isReadingResults([value]),
      )
      .pipe(
        map((response) => {
          if (response.data.readingId !== readingId)
            throw ApiError.invalidResponse(200, response.meta);
          return response;
        }),
      );
  }

  updateMeaning(
    vocabularyId: number,
    meaningId: number,
    request: VocabularyMeaningUpdateRequest,
  ): Observable<ApiSuccess<VocabularyMeaningResult>> {
    return this.api
      .put(
        `v1/admin/vocabularies/${vocabularyId}/meanings/${meaningId}`,
        {
          language: request.language,
          meaning: request.meaning,
          isPrimary: request.isPrimary,
          displayOrder: request.displayOrder,
        },
        (value): value is VocabularyMeaningResult => isMeaningResults([value]),
      )
      .pipe(
        map((response) => {
          if (response.data.meaningId !== meaningId)
            throw ApiError.invalidResponse(200, response.meta);
          return response;
        }),
      );
  }

  addPitchAccents(vocabularyId: number, requests: readonly VocabularyPitchAccentUpdateRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'pitch-accents',
      requests.map(({ readingId, accentPattern }) => ({ readingId, accentPattern })),
      'pitchAccentId',
    );
  }

  updatePitchAccent(
    vocabularyId: number,
    pitchAccentId: number,
    request: VocabularyPitchAccentUpdateRequest,
  ) {
    return this.updateMetadata(
      vocabularyId,
      'pitch-accents',
      pitchAccentId,
      { readingId: request.readingId, accentPattern: request.accentPattern },
      'pitchAccentId',
    );
  }

  addLevels(vocabularyId: number, requests: readonly LevelAssignmentAddRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'levels',
      requests.map(({ level, displayOrder }) => ({ level, displayOrder })),
      'levelId',
    );
  }

  updateLevel(vocabularyId: number, levelId: number, request: AssignmentOrderUpdateRequest) {
    return this.updateMetadata(
      vocabularyId,
      'levels',
      levelId,
      { displayOrder: request.displayOrder },
      'levelId',
    );
  }

  addLessons(vocabularyId: number, requests: readonly LessonAssignmentAddRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'lessons',
      requests.map(({ lessonId, displayOrder }) => ({ lessonId, displayOrder })),
      'lessonId',
    );
  }

  updateLesson(vocabularyId: number, lessonId: number, request: AssignmentOrderUpdateRequest) {
    return this.updateMetadata(
      vocabularyId,
      'lessons',
      lessonId,
      { displayOrder: request.displayOrder },
      'lessonId',
    );
  }

  addPartsOfSpeech(vocabularyId: number, requests: readonly PartOfSpeechAssignmentAddRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'parts-of-speech',
      requests.map(({ code }) => ({ code })),
      'partOfSpeechId',
    );
  }

  addExamples(vocabularyId: number, requests: readonly VocabularyExampleUpdateRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'examples',
      requests.map(
        ({ japaneseText, japaneseReading, meaningVi, meaningEn, targetText, displayOrder }) => ({
          japaneseText,
          japaneseReading,
          meaningVi,
          meaningEn,
          targetText,
          displayOrder,
        }),
      ),
      'exampleId',
    );
  }
  updateExample(vocabularyId: number, exampleId: number, request: VocabularyExampleUpdateRequest) {
    return this.updateMetadata(
      vocabularyId,
      'examples',
      exampleId,
      {
        japaneseText: request.japaneseText,
        japaneseReading: request.japaneseReading,
        meaningVi: request.meaningVi,
        meaningEn: request.meaningEn,
        targetText: request.targetText,
        displayOrder: request.displayOrder,
      },
      'exampleId',
    );
  }

  addKanji(vocabularyId: number, requests: readonly KanjiUpdateRequest[]) {
    return this.addMetadata(
      vocabularyId,
      'kanji',
      requests.map(({ character, strokeCount, meaningVi, meaningEn, displayOrder }) => ({
        character,
        strokeCount,
        meaningVi,
        meaningEn,
        displayOrder,
      })),
      'kanjiId',
    );
  }
  updateKanji(vocabularyId: number, kanjiId: number, request: KanjiUpdateRequest) {
    return this.updateMetadata(
      vocabularyId,
      'kanji',
      kanjiId,
      {
        character: request.character,
        strokeCount: request.strokeCount,
        meaningVi: request.meaningVi,
        meaningEn: request.meaningEn,
        displayOrder: request.displayOrder,
      },
      'kanjiId',
    );
  }

  addKanjiReadings(
    vocabularyId: number,
    kanjiId: number,
    requests: readonly KanjiReadingUpdateRequest[],
  ) {
    return this.addMetadata(
      vocabularyId,
      'kanji/' + kanjiId + '/readings',
      requests.map(({ reading, readingType, displayOrder }) => ({
        reading,
        readingType,
        displayOrder,
      })),
      'kanjiReadingId',
    );
  }
  updateKanjiReading(
    vocabularyId: number,
    kanjiId: number,
    kanjiReadingId: number,
    request: KanjiReadingUpdateRequest,
  ) {
    return this.updateMetadata(
      vocabularyId,
      'kanji/' + kanjiId + '/readings',
      kanjiReadingId,
      {
        reading: request.reading,
        readingType: request.readingType,
        displayOrder: request.displayOrder,
      },
      'kanjiReadingId',
    );
  }

  private addMetadata<K extends string>(
    vocabularyId: number,
    path: string,
    requests: readonly unknown[],
    key: K,
  ): Observable<ApiSuccess<readonly Readonly<Record<K, number>>[]>> {
    const valid = identityResult(key);
    return this.api.post(
      'v1/admin/vocabularies/' + vocabularyId + '/' + path,
      requests,
      (value): value is readonly Readonly<Record<K, number>>[] =>
        Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= 100 &&
        value.length === requests.length &&
        value.every(valid) &&
        new Set(value.map((item) => item[key])).size === value.length,
    );
  }

  private updateMetadata<K extends string>(
    vocabularyId: number,
    path: string,
    id: number,
    request: unknown,
    key: K,
  ): Observable<ApiSuccess<Readonly<Record<K, number>>>> {
    const valid = identityResult(key);
    return this.api.put(
      'v1/admin/vocabularies/' + vocabularyId + '/' + path + '/' + id,
      request,
      (value): value is Readonly<Record<K, number>> => valid(value) && value[key] === id,
    );
  }
}
