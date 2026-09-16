import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthSession } from './auth-session.service';

describe('authGuard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  const check = () => TestBed.runInInjectionContext(() => authGuard());
  it('redirects anonymous navigation to login', () => {
    const result = check();
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/login');
  });
  it('allows a session and blocks navigation during logout', () => {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    expect(check()).toBe(true);
    session.ending.set(true);
    expect(check()).toBeInstanceOf(UrlTree);
  });
});
