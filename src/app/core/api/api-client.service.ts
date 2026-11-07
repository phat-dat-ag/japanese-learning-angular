import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
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
    return this.request('GET', path, isData);
  }

  put<T>(
    path: string,
    body: unknown,
    isData: (value: unknown) => value is T,
  ): Observable<ApiSuccess<T>> {
    return this.request('PUT', path, isData, body);
  }

  post<T>(
    path: string,
    body: unknown,
    isData: (value: unknown) => value is T,
  ): Observable<ApiSuccess<T>> {
    return this.request('POST', path, isData, body);
  }

  delete<T>(path: string, isData: (value: unknown) => value is T): Observable<ApiSuccess<T>> {
    return this.request('DELETE', path, isData);
  }

  private request<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    isData: (value: unknown) => value is T,
    body?: unknown,
  ): Observable<ApiSuccess<T>> {
    return this.requestWithResponse(method, path, isData, body).pipe(
      map((response) => {
        if (!response.body) throw ApiError.invalidResponse(response.status);

        return response.body;
      }),
    );
  }

  requestWithResponse<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    isData: (value: unknown) => value is T,
    body?: unknown,
    headers: HttpHeaders | Record<string, string> = {},
  ): Observable<HttpResponse<ApiSuccess<T>>> {
    const url = this.config.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');

    return this.http
      .request<unknown>(method, url, {
        body,
        observe: 'response',
        headers: (headers instanceof HttpHeaders ? headers : new HttpHeaders(headers)).set(
          'Accept',
          'application/json',
        ),
      })
      .pipe(
        timeout(this.config.timeoutMs),
        map((response) => {
          const { body, status } = response;

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

          return response.clone({
            body: { success: true as const, data: body.data, meta: body.meta },
          });
        }),
        catchError((error: unknown) => throwError(() => normalizeApiError(error))),
      );
  }
}
