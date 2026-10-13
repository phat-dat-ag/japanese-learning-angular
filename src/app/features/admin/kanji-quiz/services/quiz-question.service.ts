import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { isQuizImportResponse, QuizImportResponse } from '../models/quiz-import.model';
import { ApiSuccess } from '../../../../core/api/api-response.model';
import {
  isQuizQuestion,
  isQuizQuestionList,
  QuizCorrectOptionRequest,
  QuizOptionTextRequest,
  QuizQuestionCreateRequest,
  QuizQuestionListResponse,
  QuizQuestionQuery,
  QuizQuestionResponse,
  QuizQuestionUpdateRequest,
  QuizVersionRequest,
} from '../models/quiz-question.model';

@Injectable({ providedIn: 'root' })
export class QuizQuestionService {
  private readonly api = inject(ApiClient);
  private readonly path = 'v1/admin/kanji-quiz/questions';

  listQuestions(query: QuizQuestionQuery = {}): Observable<ApiSuccess<QuizQuestionListResponse>> {
    let params = new HttpParams();
    for (const key of [
      'sourceType',
      'status',
      'levelId',
      'lessonId',
      'vocabularyId',
      'exampleId',
      'keyword',
      'page',
      'size',
    ] as const) {
      const value = query[key];
      if (value !== undefined) params = params.set(key, value);
    }
    const search = params.toString();
    return this.api.get(this.path + (search ? '?' + search : ''), isQuizQuestionList);
  }

  importQuestions(file: File): Observable<ApiSuccess<QuizImportResponse>> {
    const body = new FormData();
    // Browsers may label valid JSON as text/plain. Preserve bytes and filename,
    // while using one of the file-part media types accepted by the import contract.
    const upload =
      !file.type || ['application/json', 'application/octet-stream'].includes(file.type)
        ? file
        : new File([file], file.name, {
            type: 'application/json',
            lastModified: file.lastModified,
          });
    body.append('file', upload);
    return this.api.post(this.path + '/import', body, isQuizImportResponse);
  }

  getQuestion(id: number): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.get(`${this.path}/${id}`, isQuizQuestion);
  }

  createQuestion(request: QuizQuestionCreateRequest): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.post(this.path, request, isQuizQuestion);
  }

  updateQuestion(
    id: number,
    request: QuizQuestionUpdateRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.put(`${this.path}/${id}`, request, isQuizQuestion);
  }

  updateOption(
    id: number,
    optionId: number,
    request: QuizOptionTextRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.put(`${this.path}/${id}/options/${optionId}`, request, isQuizQuestion);
  }

  changeCorrectOption(
    id: number,
    request: QuizCorrectOptionRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.put(`${this.path}/${id}/correct-option`, request, isQuizQuestion);
  }

  publishQuestion(
    id: number,
    request: QuizVersionRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.post(`${this.path}/${id}/publish`, request, isQuizQuestion);
  }

  unpublishQuestion(
    id: number,
    request: QuizVersionRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.post(`${this.path}/${id}/unpublish`, request, isQuizQuestion);
  }

  archiveQuestion(
    id: number,
    request: QuizVersionRequest,
  ): Observable<ApiSuccess<QuizQuestionResponse>> {
    return this.api.post(`${this.path}/${id}/archive`, request, isQuizQuestion);
  }
}
