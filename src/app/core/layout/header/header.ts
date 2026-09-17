import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
})
export class Header {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly showNavigation = input(true);
  readonly signingOut = signal(false);
  readonly logoutError = signal('');
  toggleSidebarFromHeader = output<void>();

  logout(): void {
    if (this.signingOut() || this.auth.busy() || !this.auth.authenticated()) return;
    this.signingOut.set(true);
    this.logoutError.set('');
    this.auth
      .logout()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.signingOut.set(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
        error: () => {
          this.logoutError.set('Signed out locally, but server sign-out could not be confirmed.');
          void this.router.navigate(['/login']);
        },
      });
  }
}
