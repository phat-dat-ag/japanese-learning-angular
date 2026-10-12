import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  isQuizHistoryPage,
  isQuizHistoryDetail,
  QuizHistoryPage,
  QuizHistoryDetail,
} from '../models/quiz-history.model';
import {
  isQuizProgress,
  isQuizProgressBreakdown,
  QuizProgress,
  QuizProgressBreakdown,
} from '../models/quiz-progress.model';
import {
  isQuizSession,
  isQuizNextQuestion,
  isQuizAnswer,
  isQuizCompletion,
  QuizSession,
  QuizNextQuestion,
  QuizAnswer,
  QuizAnswerRequest,
  QuizCompletion,
} from '../models/quiz-gameplay.model';
import { ApiClient } from '../../../core/api/api-client.service';
import { ApiSuccess } from '../../../core/api/api-response.model';
import {
  isQuizGameConfig,
  isQuizSessionCreated,
  QuizGameConfig,
  QuizSessionCreated,
  QuizSessionCreateRequest,
} from '../models/quiz-player.model';

@Injectable({ providedIn: 'root' })
export class QuizPlayerService {
  private readonly api = inject(ApiClient);
  private readonly path = 'v1/kanji-quiz';

  getConfig(): Observable<ApiSuccess<QuizGameConfig>> {
    return this.api.get(this.path + '/config', isQuizGameConfig);
  }

  createSession(request: QuizSessionCreateRequest): Observable<ApiSuccess<QuizSessionCreated>> {
    return this.api.post(this.path + '/sessions', request, isQuizSessionCreated);
  }

  getSession(id: number): Observable<ApiSuccess<QuizSession>> {
    return this.api.get(
      this.path + '/sessions/' + id,
      (value): value is QuizSession => isQuizSession(value) && value.sessionId === id,
    );
  }

  getNextQuestion(id: number): Observable<ApiSuccess<QuizNextQuestion>> {
    return this.api.get(
      this.path + '/sessions/' + id + '/next',
      (value): value is QuizNextQuestion => isQuizNextQuestion(value) && value.sessionId === id,
    );
  }

  submitAnswer(id: number, request: QuizAnswerRequest): Observable<ApiSuccess<QuizAnswer>> {
    return this.api.post(
      this.path + '/sessions/' + id + '/answers',
      request,
      (value): value is QuizAnswer =>
        isQuizAnswer(value) && value.sessionQuestionId === request.sessionQuestionId,
    );
  }

  finishSession(id: number): Observable<ApiSuccess<QuizCompletion>> {
    return this.api.post(
      this.path + '/sessions/' + id + '/finish',
      undefined,
      (value): value is QuizCompletion => isQuizCompletion(value) && value.sessionId === id,
    );
  }

  getHistory(page = 0, size = 20): Observable<ApiSuccess<QuizHistoryPage>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.api.get(
      this.path + '/history?' + params.toString(),
      (value): value is QuizHistoryPage =>
        isQuizHistoryPage(value) && value.page === page && value.size === size,
    );
  }

  getHistoryDetail(id: number): Observable<ApiSuccess<QuizHistoryDetail>> {
    return this.api.get(
      this.path + '/history/' + id,
      (value): value is QuizHistoryDetail =>
        isQuizHistoryDetail(value) && value.session.sessionId === id,
    );
  }

  getProgress(): Observable<ApiSuccess<QuizProgress>> {
    return this.api.get(this.path + '/progress', isQuizProgress);
  }

  getProgressBreakdown(): Observable<ApiSuccess<QuizProgressBreakdown>> {
    return this.api.get(this.path + '/progress/breakdown', isQuizProgressBreakdown);
  }
}
