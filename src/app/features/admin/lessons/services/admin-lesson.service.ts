import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { ApiError } from '../../../../core/api/api-error';
import {
  isLessonLevels,
  isLessonList,
  isLessonMetadata,
  LessonLevelCode,
  LessonWriteRequest,
} from '../models/lesson.model';

@Injectable({ providedIn: 'root' })
export class AdminLessonService {
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
