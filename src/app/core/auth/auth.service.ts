import { inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiError } from '../api/api-error';
import { AuthApi } from './auth-api.service';
import { AuthSession } from './auth-session.service';
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly session = inject(AuthSession);
  private refreshRequest: Observable<TokenResponse> | null = null;
  private readonly working = signal(false);
  readonly busy = this.working.asReadonly();
  readonly user = this.session.user;
  readonly authenticated = this.session.authenticated;

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.api.register(request);
  }

  login(request: LoginRequest): Observable<AuthUser> {
    return defer(() => {
      if (this.busy() || this.refreshRequest || this.authenticated()) {
        return throwError(
          () => new ApiError('AUTH_BUSY', 'Please finish the current session first.', 0),
        );
      }
      this.working.set(true);
      this.session.clear();
      const revision = this.session.revision;
      return this.api.login(request).pipe(
        tap((tokens) => this.session.replace(tokens)),
        switchMap(() => this.loadUser()),
        catchError((error: unknown) => {
          if (this.session.revision === revision) this.session.clear();
          return throwError(() => error);
        }),
        finalize(() => this.working.set(false)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    });
  }

  loadUser(): Observable<AuthUser> {
    const revision = this.session.revision;
    return this.api.me().pipe(
      tap((user) => {
        if (this.session.revision === revision && this.session.authenticated())
          this.session.setUser(user);
      }),
    );
  }

  refresh(): Observable<TokenResponse> {
    if (this.refreshRequest) return this.refreshRequest;
    const tokens = this.session.tokens();
    if (!tokens || this.session.ending()) {
      return throwError(() => new ApiError('NO_SESSION', 'Please sign in.', 401));
    }
    const revision = this.session.revision;
    this.refreshRequest = this.api.refresh(tokens.refreshToken).pipe(
      tap((replacement) => {
        if (this.session.revision !== revision)
          throw new ApiError('SESSION_CHANGED', 'Please sign in.', 401);
        this.session.replace(replacement);
      }),
      catchError((error: unknown) => {
        if (this.session.revision === revision) this.session.clear();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshRequest = null;
      }),
      // Complete rotation even if the original page/request is destroyed.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    return defer(() => {
      if (this.busy()) return throwError(() => new ApiError('AUTH_BUSY', 'Please wait.', 0));
      this.working.set(true);
      this.session.ending.set(true);
      // Revoke the replacement token when logout overlaps an in-flight rotation.
      const settled: Observable<TokenResponse | null> = this.refreshRequest ?? of(null);
      return settled.pipe(
        switchMap(() => {
          const tokens = this.session.tokens();
          this.session.clear();
          return tokens ? this.api.logout(tokens.refreshToken) : of(undefined);
        }),
        map(() => undefined),
        finalize(() => {
          this.session.clear();
          this.working.set(false);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    });
  }
}
