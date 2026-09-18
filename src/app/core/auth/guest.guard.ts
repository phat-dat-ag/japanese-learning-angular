import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthSession } from './auth-session.service';
import { authDestination } from './auth-destination';

export const guestGuard = (): boolean | UrlTree => {
  const session = inject(AuthSession);
  const user = session.user();
  return !session.authenticated() || !user || inject(Router).createUrlTree([authDestination(user)]);
};

export const guestLayoutMatch: CanMatchFn = (_route, segments) => {
  if (segments.length > 0) return true;
  const session = inject(AuthSession);
  return !session.authenticated() || !session.user();
};
