import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_CONFIG } from '../api/api.config';
import { SKIP_AUTH } from './auth-http.context';
import { AuthSession } from './auth-session.service';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const document = inject(DOCUMENT);
  let root: URL;
  let target: URL;
  try {
    root = new URL(config.baseUrl.replace(/\/$/, '') + '/', document.baseURI);
    target = new URL(request.url, document.baseURI);
  } catch {
    return next(request);
  }
  const apiPath = target.pathname.slice(root.pathname.length);
  if (
    target.origin !== root.origin ||
    !target.pathname.startsWith(root.pathname) ||
    request.context.get(SKIP_AUTH) ||
    /^auth\/(login|refresh|logout)\/?$/.test(apiPath)
  ) {
    return next(request);
  }

  const session = inject(AuthSession);
  const auth = inject(AuthService);
  const token = session.authenticated() ? session.tokens()?.accessToken : undefined;
  const revision = session.revision;
  const withToken = (accessToken: string) =>
    request.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
    });

  const retry = (accessToken: string) =>
    next(withToken(accessToken)).pipe(
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          session.revision === revision &&
          session.tokens()?.accessToken === accessToken
        )
          session.clear();
        return throwError(() => error);
      }),
    );

  return next(token ? withToken(token) : request).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !token ||
        !session.authenticated() ||
        session.revision !== revision
      )
        return throwError(() => error);
      const current = session.tokens();
      if (!current) return throwError(() => error);
      // A late 401 for an old token can reuse an already completed rotation.
      if (current.accessToken !== token) return retry(current.accessToken);
      return auth
        .refresh()
        .pipe(
          switchMap((tokens) =>
            session.authenticated() && session.revision === revision
              ? retry(tokens.accessToken)
              : throwError(() => error),
          ),
        );
    }),
  );
};
