import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client.service';
import { ApiError } from '../../../core/api/api-error';
import { isRecord } from '../../../core/api/api-response.model';
import { isLessonContentResponse, LessonContentResponse } from '../models/grammar-content.model';
import {
  isLessonLevels,
  isLessonList,
  isLessonMetadata,
  LessonLevelCode,
} from '../models/lesson.model';

export function isSupportedContentResponse(value: unknown): value is LessonContentResponse {
  if (isRecord(value) && typeof value['schemaVersion'] === 'number' && value['schemaVersion'] !== 1)
    throw new ApiError(
      'LESSON_CONTENT_SCHEMA_UNSUPPORTED',
      'Only grammar schema version 1 is supported.',
      200,
    );

  return isLessonContentResponse(value);
}

@Injectable({ providedIn: 'root' })
export class LessonReadService {
  private readonly api = inject(ApiClient);

  getLevels() {
    return this.api.get('v1/jlpt-levels', isLessonLevels);
  }

  getLessons(level: LessonLevelCode) {
    return this.api.get(`v1/lessons?level=${encodeURIComponent(level)}`, isLessonList);
  }

  getLesson(id: number) {
    return this.api.get(`v1/lessons/${id}`, isLessonMetadata).pipe(
      map((response) => {
        if (response.data.id !== id) throw ApiError.invalidResponse(200, response.meta);
        return response;
      }),
    );
  }

  getContent(id: number) {
    // Reading does not require an ETag. Admin mutations still use the response-aware client.
    return this.api.get(`v1/lessons/${id}/content`, isSupportedContentResponse).pipe(
      map((response) => {
        if (response.data.lessonId !== id) throw ApiError.invalidResponse(200, response.meta);
        return response;
      }),
    );
  }
}
