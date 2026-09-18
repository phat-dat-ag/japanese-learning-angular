import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthSession } from './auth-session.service';
import { authDestination } from './auth-destination';

function checkRole(admin: boolean): boolean | UrlTree {
  const session = inject(AuthSession);
  const router = inject(Router);
  const user = session.user();
  if (!session.authenticated() || !user) return router.createUrlTree(['/login']);
  return (user.role === 'Admin') === admin || router.createUrlTree([authDestination(user)]);
}

export const userGuard = (): boolean | UrlTree => checkRole(false);
export const adminGuard = (): boolean | UrlTree => checkRole(true);
