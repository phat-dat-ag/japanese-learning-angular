import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../../core/api/api-client.service';
import { ApiSuccess } from '../../../core/api/api-response.model';
import { FlashcardLesson, isFlashcardLessons } from '../models/flashcard-lesson.model';

@Injectable({ providedIn: 'root' })
export class LessonService {
  private readonly api = inject(ApiClient);

  getLessons(level: string): Observable<ApiSuccess<readonly FlashcardLesson[]>> {
    return this.api.get(
      `lessons?level=${encodeURIComponent(level.toLowerCase())}`,
      isFlashcardLessons,
    );
  }
}
