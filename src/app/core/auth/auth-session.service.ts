import { computed, Injectable, signal } from '@angular/core';
import { AuthUser, TokenResponse } from './auth.models';

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

// Intentionally memory-only: no password or tokens survive a page reload.
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly storedTokens = signal<AuthTokens | null>(null);
  private readonly storedUser = signal<AuthUser | null>(null);
  readonly tokens = this.storedTokens.asReadonly();
  readonly user = this.storedUser.asReadonly();
  readonly ending = signal(false);
  readonly authenticated = computed(() => this.tokens() !== null && !this.ending());
  private generation = 0;

  get revision(): number {
    return this.generation;
  }

  replace(tokens: TokenResponse): void {
    this.storedTokens.set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    });
  }

  setUser(user: AuthUser): void {
    this.storedUser.set(user);
  }

  clear(): void {
    this.generation++;
    this.storedTokens.set(null);
    this.storedUser.set(null);
    this.ending.set(false);
  }
}
