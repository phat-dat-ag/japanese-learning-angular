import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError, timeout } from 'rxjs';

import { ApiError, normalizeApiError } from './api-error';
import { ApiSuccess, isApiResponse } from './api-response.model';
import { API_CONFIG } from './api.config';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  get<T>(path: string, isData: (value: unknown) => value is T): Observable<ApiSuccess<T>> {
    const url = this.config.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');

    return this.http
      .get<unknown>(url, {
        observe: 'response',
        headers: { Accept: 'application/json' },
      })
      .pipe(
        timeout(this.config.timeoutMs),
        map(({ body, status }) => {
          if (!isApiResponse(body)) {
            throw ApiError.invalidResponse(status);
          }
          if (!body.success) {
            throw new ApiError(
              body.error.code,
              body.error.message,
              status,
              body.error.details,
              body.meta,
            );
          }
          if (!isData(body.data)) {
            throw ApiError.invalidResponse(status, body.meta);
          }

          return { success: true as const, data: body.data, meta: body.meta };
        }),
        catchError((error: unknown) => throwError(() => normalizeApiError(error))),
      );
  }
}
