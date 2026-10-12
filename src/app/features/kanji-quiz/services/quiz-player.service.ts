import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
}
