import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthSession } from './auth-session.service';

export const authGuard = (): boolean | UrlTree =>
  inject(AuthSession).authenticated() || inject(Router).createUrlTree(['/login']);
