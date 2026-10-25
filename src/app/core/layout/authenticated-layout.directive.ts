import { Directive, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { learningSessionDestination } from '../auth/auth-destination';
import { AuthSession } from '../auth/auth-session.service';

@Directive({
  selector: '[appAuthenticatedLayout]',
})
export class AuthenticatedLayout {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  constructor() {
    // Guards protect navigation; this also leaves a mounted layout when the session ends.
    effect(() => {
      if (!this.session.authenticated()) {
        const returnUrl = learningSessionDestination(this.router.url);
        void this.router.navigate(['/login'], {
          replaceUrl: true,
          queryParams: returnUrl ? { returnUrl } : undefined,
        });
      }
    });
  }
}
