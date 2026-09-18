import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';
import { authInterceptor } from '../../core/auth/auth.interceptor';

@Component({ template: 'Protected learning page' })
class LearningPage { }

describe('Authentication routing', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter(
          routes.map((route) =>
            route.children
              ? {
                ...route,
                children: route.children.map((child) =>
                  child.path === 'flashcards'
                    ? {
                      ...child,
                      loadChildren: undefined,
                      component: LearningPage,
                      children: [{ path: ':level', component: LearningPage }],
                    }
                    : child,
                ),
              }
              : route,
          ),
        ),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function signIn(role: string): void {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'id', username: 'Account name', role });
  }

  it('shows a minimal guest home with login/register actions and no learning navigation', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.textContent).toContain('Welcome, guest');
    expect(harness.routeNativeElement?.querySelector('a[href="/login"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/register"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-sidebar')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('[aria-label="Toggle sidebar"]')).toBeNull();
  });

  it('opens both public forms and shows registration success without credentials', async () => {
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

  it.each(['/flashcards', '/flashcards/N5', '/admin'])(
    'redirects anonymous navigation from %s to Login',
    async (url) => {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(harness.routeNativeElement?.querySelector('app-sidebar')).toBeNull();
    },
  );

  it('does not enter a protected layout before /me supplies identity', async () => {
    TestBed.inject(AuthSession).replace({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 60,
    });
    await RouterTestingHarness.create('/admin');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it.each(['/', '/flashcards', '/flashcards/N5'])(
    'preserves the User layout at %s',
    async (url) => {
      signIn('User');
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe(url);
      expect(harness.routeNativeElement?.querySelector('app-sidebar')).not.toBeNull();
      expect(harness.routeNativeElement?.textContent).toContain('Learning Center');
      expect(harness.routeNativeElement?.textContent).toContain('Account name');
      expect(harness.routeNativeElement?.textContent).not.toContain('Admin Dashboard');
    },
  );

  it('blocks a User from the Admin area', async () => {
    signIn('User');
    const harness = await RouterTestingHarness.create('/admin');
    expect(TestBed.inject(Router).url).toBe('/flashcards');
    expect(harness.routeNativeElement?.textContent).toContain('Protected learning page');
    expect(harness.routeNativeElement?.textContent).not.toContain('Admin Dashboard');
  });

  it.each(['/login', '/register'])('redirects a User from %s to learning', async (url) => {
    signIn('User');
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/flashcards');
  });

  it.each(['/', '/login', '/register', '/flashcards', '/flashcards/N5', '/admin'])(
    'shows only the Admin area for an Admin visiting %s',
    async (url) => {
      signIn('Admin');
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/admin');
      expect(harness.routeNativeElement?.textContent).toContain('Admin Dashboard');
      expect(harness.routeNativeElement?.textContent).toContain('Account name');
      expect(harness.routeNativeElement?.textContent).toContain('Sign out');
      expect(harness.routeNativeElement?.querySelector('app-sidebar')).toBeNull();
      expect(harness.routeNativeElement?.querySelector('[aria-label="Toggle sidebar"]')).toBeNull();
    },
  );

  it.each(['User', 'Admin'])('leaves the mounted %s layout when refresh fails', async (role) => {
    signIn(role);
    const harness = await RouterTestingHarness.create(role === 'Admin' ? '/admin' : '/flashcards');
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient)
      .get('/api/session-check')
      .subscribe({ error: () => undefined });
    http.expectOne('/api/session-check').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('app-login')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-sidebar')).toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('Admin Dashboard');
  });

  it.each(['User', 'Admin'])(
    'logs out of the %s layout into the login experience',
    async (role) => {
      signIn(role);
      const harness = await RouterTestingHarness.create(
        role === 'Admin' ? '/admin' : '/flashcards',
      );
      const button = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
        (element) => element.textContent?.includes('Sign out'),
      );
      expect(button).toBeDefined();
      button?.click();
      TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(null);
      await TestBed.inject(ApplicationRef).whenStable();
      harness.detectChanges();
      expect(TestBed.inject(AuthSession).user()).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(harness.routeNativeElement?.querySelector('app-login')).not.toBeNull();
      await harness.navigateByUrl('/');
      expect(harness.routeNativeElement?.textContent).toContain('Welcome, guest');
    },
  );
});
