import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
}
