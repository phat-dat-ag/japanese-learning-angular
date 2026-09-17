import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  readonly loading = signal(false);
  readonly error = signal('');

  get valid(): boolean {
    return (
      this.username.trim().length > 0 &&
      this.username.length <= 100 &&
      this.email.trim().length <= 255 &&
      /^[^@]+@[^@]+$/.test(this.email.trim()) &&
      this.password.trim().length > 0 &&
      this.password.length >= 8 &&
      this.password.length <= 100 &&
      this.password === this.confirmPassword
    );
  }

  submit(): void {
    if (!this.valid || this.loading() || this.auth.busy()) return;
    this.loading.set(true);
    this.error.set('');
    const request = {
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password,
    };
    this.password = '';
    this.confirmPassword = '';
    this.auth
      .register(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 409) {
            if (error.code === 'USERNAME_ALREADY_EXISTS') {
              this.error.set('This username is already taken. Choose another username.');
              return;
            }
            if (error.code === 'EMAIL_ALREADY_EXISTS') {
              this.error.set('This email is already registered. Sign in or use another email.');
              return;
            }
          }
          this.error.set('Unable to create your account. Please check your details and try again.');
        },
      });
  }
}
