import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session.service';

export const grammarReadGuard = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  if (!session.authenticated() || !session.user()) return router.createUrlTree(['/login']);
  return (
    session.user()?.role === 'User' ||
    session.user()?.role === 'Admin' ||
    router.createUrlTree(['/'])
  );
};
