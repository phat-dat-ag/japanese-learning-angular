import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { authDestination } from '../../core/auth/auth-destination';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly registered = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('registered') === 'true')),
    { initialValue: false },
  );
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    if (
      this.loading() ||
      this.auth.busy() ||
      !/^[^@]+@[^@]+$/.test(this.email.trim()) ||
      !this.password.trim()
    )
      return;
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
        next: (user) => {
          void this.router.navigate([authDestination(user)]);
        },
        error: () =>
          this.error.set('Unable to sign in. Check your email and password and try again.'),
      });
  }
}
