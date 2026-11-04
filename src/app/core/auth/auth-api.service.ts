import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError, timeout } from 'rxjs';
import { API_CONFIG } from '../api/api.config';
import { ApiError, normalizeApiError } from '../api/api-error';
import { isApiResponse, isRecord } from '../api/api-response.model';
import {
  AuthUser,
  isAuthUser,
  isTokenResponse,
  LoginRequest,
  TokenResponse,
  RegisterRequest,
  RegisterResponse,
  isRegisterResponse,
} from './auth.models';
import { SKIP_AUTH } from './auth-http.context';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly root = this.config.baseUrl.replace(/\/$/, '') + '/auth';

  register(request: RegisterRequest): Observable<RegisterResponse> {
    const { username, email, password } = request;
    return this.validate(
      this.http.post<unknown>(
        `${this.root}/register`,
        { username, email, password },
        this.options(),
      ),
      isRegisterResponse,
    );
  }

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.validate(
      this.http.post<unknown>(`${this.root}/login`, request, this.options()),
      isTokenResponse,
    );
  }

  refresh(refreshToken: string): Observable<TokenResponse> {
    return this.validate(
      this.http.post<unknown>(`${this.root}/refresh`, { refreshToken }, this.options()),
      isTokenResponse,
    );
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.root}/logout`, { refreshToken }, this.options()).pipe(
      timeout(this.config.timeoutMs),
      catchError((error: unknown) => throwError(() => this.normalizeError(error))),
    );
  }

  me(): Observable<AuthUser> {
    return this.validate(
      this.http.get<unknown>(`${this.root}/me`, {
        headers: { Accept: 'application/json' },
      }),
      isAuthUser,
    );
  }

  private normalizeError(error: unknown): ApiError {
    const normalized = normalizeApiError(error);
    if (!(error instanceof HttpErrorResponse)) return normalized;

    const body: unknown = error.error;
    if (isApiResponse(body)) return normalized;
    if (!isRecord(body) || body['success'] !== false || !isRecord(body['error'])) return normalized;

    const detail = body['error'];
    if (typeof detail['code'] !== 'string' || typeof detail['message'] !== 'string')
      return normalized;
    const details: unknown = detail['details'] ?? [];
    if (
      !Array.isArray(details) ||
      !details.every(
        (item: unknown): item is { field?: string | null; message: string } =>
          isRecord(item) &&
          (item['field'] == null || typeof item['field'] === 'string') &&
          typeof item['message'] === 'string',
      )
    )
      return normalized;

    // Accept the legacy error shape while older .NET instances finish rolling out.
    return new ApiError(
      detail['code'],
      'The request could not be completed. Please try again.',
      error.status,
      details.map((item) => ({ field: item.field ?? '', message: item.message })),
      undefined,
      typeof body['traceId'] === 'string' ? body['traceId'] : undefined,
    );
  }

  private options() {
    return {
      context: new HttpContext().set(SKIP_AUTH, true),
      headers: { Accept: 'application/json' },
    };
  }

  // Unwrap the shared envelope; accept legacy DTOs during a rolling backend deployment.
  private validate<T>(
    request: Observable<unknown>,
    guard: (value: unknown) => value is T,
  ): Observable<T> {
    return request.pipe(
      timeout(this.config.timeoutMs),
      map((body) => {
        if (isApiResponse(body)) {
          if (!body.success)
            throw new ApiError(
              body.error.code,
              body.error.message,
              200,
              body.error.details,
              body.meta,
            );
          if (!guard(body.data)) throw ApiError.invalidResponse(200, body.meta);
          return body.data;
        }
        if ((isRecord(body) && 'success' in body) || !guard(body))
          throw ApiError.invalidResponse(200);
        return body;
      }),
      catchError((error: unknown) => throwError(() => this.normalizeError(error))),
    );
  }
}
