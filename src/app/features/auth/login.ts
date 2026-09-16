import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    if (this.loading() || this.auth.busy() || !this.email.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    const request = { email: this.email.trim(), password: this.password };
    this.password = '';
    this.auth
      .login(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/flashcards']);
        },
        error: () =>
          this.error.set('Unable to sign in. Check your email and password and try again.'),
      });
  }

  logout(): void {
    if (this.loading() || this.auth.busy()) return;
    this.error.set('');
    this.loading.set(true);
    this.auth
      .logout()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        error: () =>
          this.error.set('Signed out locally, but server sign-out could not be confirmed.'),
      });
  }
}
