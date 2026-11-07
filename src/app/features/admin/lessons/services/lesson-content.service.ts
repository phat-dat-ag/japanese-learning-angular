import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import { ApiError } from '../../../../core/api/api-error';
import { isRecord } from '../../../../core/api/api-response.model';
import {
  GrammarDocument,
  isLessonContentResponse,
  LessonContentResponse,
  LessonContentSnapshot,
  LessonContentWriteRequest,
} from '../models/grammar-content.model';
import { positiveInteger } from '../models/lesson.model';

function contentResponse(value: unknown): value is LessonContentResponse {
  if (isRecord(value) && typeof value['schemaVersion'] === 'number' && value['schemaVersion'] !== 1)
    throw new ApiError(
      'LESSON_CONTENT_SCHEMA_UNSUPPORTED',
      'Only schema version 1 can be edited.',
      200,
    );
  return isLessonContentResponse(value);
}
export function isStrongEtag(value: string | null): value is string {
  return value !== null && /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value);
}
@Injectable({ providedIn: 'root' })
export class LessonContentService {
  private readonly api = inject(ApiClient);
  getContent(id: number) {
    return this.snapshot('GET', id);
  }
  saveContent(
    id: number,
    content: GrammarDocument,
    revision: { readonly version: number; readonly etag: string } | null,
  ) {
    if (revision) this.requireRevision(revision);
    const body: LessonContentWriteRequest = {
      schemaVersion: 1,
      expectedVersion: revision?.version ?? 0,
      content,
    };
    return this.snapshot('PUT', id, body, revision?.etag);
  }
  deleteContent(id: number, revision: { readonly version: number; readonly etag: string }) {
    this.requireRevision(revision);
    return this.api
      .requestWithResponse(
        'DELETE',
        `v1/lessons/${id}/content?expectedVersion=${revision.version}`,
        contentResponse,
        undefined,
        { 'If-Match': revision.etag },
      )
      .pipe(
        map((response) => {
          if (!response.body || response.body.data.lessonId !== id)
            throw ApiError.invalidResponse(response.status);
          return response.body;
        }),
      );
  }
  private requireRevision(revision: { readonly version: number; readonly etag: string }): void {
    if (!positiveInteger(revision.version) || !isStrongEtag(revision.etag))
      throw new ApiError(
        'LESSON_CONTENT_PRECONDITION_INVALID',
        'Reload the document before saving.',
        0,
      );
  }
  private snapshot(
    method: 'GET' | 'PUT',
    id: number,
    body?: LessonContentWriteRequest,
    etag?: string,
  ) {
    return this.api
      .requestWithResponse(
        method,
        `v1/lessons/${id}/content`,
        contentResponse,
        body,
        etag === undefined ? {} : { 'If-Match': etag },
      )
      .pipe(
        map((response): LessonContentSnapshot => {
          if (!response.body || response.body.data.lessonId !== id)
            throw ApiError.invalidResponse(response.status);
          const etag = response.headers.get('ETag');
          if (!isStrongEtag(etag))
            throw new ApiError(
              'LESSON_CONTENT_ETAG_MISSING',
              'A valid content ETag was not returned. Reload before making changes.',
              response.status,
              [],
              response.body.meta,
            );
          return { document: response.body.data, etag };
        }),
      );
  }
}
