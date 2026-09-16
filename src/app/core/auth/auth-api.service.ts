import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError, timeout } from 'rxjs';
import { API_CONFIG } from '../api/api.config';
import { ApiError, normalizeApiError } from '../api/api-error';
import { AuthUser, isAuthUser, isTokenResponse, LoginRequest, TokenResponse } from './auth.models';
import { SKIP_AUTH } from './auth-http.context';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly root = this.config.baseUrl.replace(/\/$/, '') + '/auth';

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
      catchError((error: unknown) => throwError(() => normalizeApiError(error))),
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

  private options() {
    return {
      context: new HttpContext().set(SKIP_AUTH, true),
      headers: { Accept: 'application/json' },
    };
  }

  // .NET success bodies are plain JSON, not the Quarkus ApiClient envelope.
  private validate<T>(
    request: Observable<unknown>,
    guard: (value: unknown) => value is T,
  ): Observable<T> {
    return request.pipe(
      timeout(this.config.timeoutMs),
      map((body) => {
        if (!guard(body)) throw ApiError.invalidResponse(200);
        return body;
      }),
      catchError((error: unknown) => throwError(() => normalizeApiError(error))),
    );
  }
}
