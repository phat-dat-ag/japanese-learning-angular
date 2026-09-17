import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';

@Component({ template: 'Protected learning page' })
class LearningPage {}

describe('Authentication routing', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          routes.map((route) =>
            route.children
              ? {
                  ...route,
                  children: route.children.map((child) =>
                    child.path === 'flashcards'
                      ? { ...child, loadChildren: undefined, component: LearningPage }
                      : child,
                  ),
                }
              : route,
          ),
        ),
      ],
    }),
  );

  it('opens both public forms, hides the sidebar, and shows registration success without credentials', async () => {
    const harness = await RouterTestingHarness.create('/login');
    expect(harness.routeNativeElement?.querySelector('app-login')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-sidebar')).toBeNull();
    await harness.navigateByUrl('/register');
    expect(harness.routeNativeElement?.querySelector('app-register')).not.toBeNull();
    await harness.navigateByUrl('/login?registered=true');
    expect(harness.routeNativeElement?.textContent).toContain('Your account has been created');
    expect(
      harness.routeNativeElement?.querySelector<HTMLInputElement>('input[name=password]')?.value,
    ).toBe('');
  });

  it('redirects anonymous protected navigation to Login', async () => {
    await RouterTestingHarness.create('/flashcards');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it.each(['/login', '/register'])(
    'redirects authenticated navigation from %s to learning',
    async (url) => {
      TestBed.inject(AuthSession).replace({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 60,
      });
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/flashcards');
      expect(harness.routeNativeElement?.textContent).toContain('Protected learning page');
    },
  );
});
