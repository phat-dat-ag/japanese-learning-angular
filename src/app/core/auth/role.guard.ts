import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthSession } from './auth-session.service';
import { authDestination, learningSessionDestination } from './auth-destination';

function checkRole(admin: boolean, url?: string): boolean | UrlTree {
  const session = inject(AuthSession);
  const router = inject(Router);
  const user = session.user();
  if (!session.authenticated() || !user) {
    const returnUrl = !admin ? learningSessionDestination(url) : null;
    return router.createUrlTree(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }
  return (user.role === 'Admin') === admin || router.createUrlTree([authDestination(user)]);
}

export const userGuard: CanActivateFn = (_route, state) => checkRole(false, state.url);
export const adminGuard = (): boolean | UrlTree => checkRole(true);
