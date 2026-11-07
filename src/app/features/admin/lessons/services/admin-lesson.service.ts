import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { ApiError } from '../../../../core/api/api-error';
import { LessonReadService } from '../../../grammar/services/lesson-read.service';
import { isLessonMetadata, LessonLevelCode, LessonWriteRequest } from '../models/lesson.model';

@Injectable({ providedIn: 'root' })
export class AdminLessonService {
  private readonly api = inject(ApiClient);
  private readonly reads = inject(LessonReadService);
  getLevels() {
    return this.reads.getLevels();
  }
  getLessons(level: LessonLevelCode) {
    return this.reads.getLessons(level);
  }
  getLesson(id: number) {
    return this.reads.getLesson(id);
  }
  createLesson(body: LessonWriteRequest) {
    return this.api.post('v1/lessons', body, isLessonMetadata);
  }
  updateLesson(id: number, body: LessonWriteRequest) {
    return this.api.put(`v1/lessons/${id}`, body, isLessonMetadata).pipe(
      map((response) => {
        if (response.data.id !== id) throw ApiError.invalidResponse(200, response.meta);
        return response;
      }),
    );
  }
  deleteLesson(id: number) {
    return this.api.delete(`v1/lessons/${id}`, isLessonMetadata).pipe(
      map((response) => {
        if (response.data.id !== id) throw ApiError.invalidResponse(200, response.meta);
        return response;
      }),
    );
  }
}
