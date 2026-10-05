import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client.service';
import { ApiSuccess } from '../../../core/api/api-response.model';
import {
  ImportKind,
  isLessonBatchResponse,
  isVocabularyImportResult,
  LessonBatchResponse,
  VocabularyImportResult,
} from './import.models';

export const LESSON_FILE_LIMIT = 1048576;

export function validateImportFile(file: File | null, kind: ImportKind): string | null {
  if (!file) return 'Choose a JSON file to import.';

  if (file.size === 0) return 'The selected file is empty. Choose a non-empty JSON file.';

  if (kind === 'lessons' && file.size > LESSON_FILE_LIMIT)
    return 'Lesson files must be at most 1 MiB (1,048,576 bytes).';

  return null;
}

@Injectable({ providedIn: 'root' })
export class FileImportService {
  private readonly api = inject(ApiClient);

  importVocabulary(file: File): Observable<ApiSuccess<VocabularyImportResult>> {
    return this.api.post('vocabularies/import', this.upload(file), isVocabularyImportResult);
  }

  importLessons(file: File): Observable<ApiSuccess<LessonBatchResponse>> {
    return this.api.post('v1/lessons/batch', this.upload(file), isLessonBatchResponse);
  }

  private upload(file: File): FormData {
    const body = new FormData();

    body.append('file', file, file.name);

    return body;
  }
}
