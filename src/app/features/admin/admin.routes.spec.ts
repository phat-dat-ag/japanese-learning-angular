import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';

@Component({ template: 'Destination' })
class Destination { }

const sections = [
  ['vocabulary', 'Vocabulary Management'],
  ['lessons', 'Lesson Management'],
  ['users', 'User Management'],
  ['settings', 'Settings'],
] as const;

describe('Admin interface', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          ...routes.filter((route) => route.path === 'admin'),
          { path: 'login', component: Destination },
          { path: 'flashcards', component: Destination },
        ]),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function signIn(role = 'Admin'): void {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'id', username: 'Admin account', role });
  }

  it('renders the dashboard, account information, and overview links without data requests', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/admin');
    const page = harness.routeNativeElement;
    expect(page?.querySelector('h1')?.textContent).toContain('Admin Dashboard');
    expect(page?.querySelector('header')?.textContent).toContain('Admin account');
    expect(page?.querySelector('header')?.textContent).toContain('Sign out');
    expect(page?.querySelector('main')?.textContent).toContain('JLPT Levels');
    expect(page?.querySelector('main')?.textContent).toContain('Management tools coming soon');
    expect(page?.querySelector('nav a[aria-current="page"]')?.textContent).toContain('Dashboard');
    for (const [path] of sections) {
      expect(page?.querySelector('main a[href="/admin/' + path + '"]')).not.toBeNull();
    }
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it.each(sections)('renders the %s placeholder on direct navigation', async (path, title) => {
    signIn();
    const harness = await RouterTestingHarness.create('/admin/' + path);
    const page = harness.routeNativeElement;
    expect(page?.querySelector('h1')?.textContent).toBe(title);
    expect(page?.querySelector('header')?.textContent).toContain(title);
    expect(page?.querySelector('main')?.textContent).toContain('Coming soon');
    expect(page?.querySelector('main')?.textContent).toContain(
      'Management actions are not available yet',
    );
    expect(page?.querySelector('main form, main table')).toBeNull();
    expect(page?.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe(
      '/admin/' + path,
    );
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it.each(['/admin', ...sections.map(([path]) => '/admin/' + path)])(
    'blocks Guests and Users from %s',
    async (url) => {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
      signIn('User');
      await harness.navigateByUrl(url);
      expect(TestBed.inject(Router).url).toBe('/flashcards');
      expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
    },
  );

  it('navigates between sections in the same shell and updates titles and active items', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/admin');
    const shell = harness.routeNativeElement;
    for (const [path, title] of sections) {
      shell?.querySelector<HTMLAnchorElement>('nav a[href="/admin/' + path + '"]')?.click();
      await TestBed.inject(ApplicationRef).whenStable();
      harness.detectChanges();
      expect(harness.routeNativeElement).toBe(shell);
      expect(TestBed.inject(Router).url).toBe('/admin/' + path);
      expect(shell?.querySelector('h1')?.textContent).toBe(title);
      expect(shell?.querySelector('header')?.textContent).toContain(title);
      expect(shell?.querySelectorAll('nav a[aria-current="page"]').length).toBe(1);
    }
    shell?.querySelector<HTMLAnchorElement>('main a[href="/admin"]')?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin');
  });

  it('expands and closes mobile navigation with accessible state and Escape focus', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/admin');
    const page = harness.routeNativeElement;
    const toggle = page?.querySelector<HTMLButtonElement>(
      'button[aria-controls="admin-navigation"]',
    );
    const nav = page?.querySelector<HTMLElement>('#admin-navigation');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(nav?.classList.contains('hidden')).toBe(true);
    toggle?.click();
    harness.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(nav?.classList.contains('hidden')).toBe(false);
    nav?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    harness.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    toggle?.click();
    harness.detectChanges();
    nav?.querySelector<HTMLAnchorElement>('a[href="/admin/lessons"]')?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(TestBed.inject(Router).url).toBe('/admin/lessons');
  });

  it.each([204, 500])('uses existing logout from a child page on HTTP %s', async (status) => {
    signIn();
    const harness = await RouterTestingHarness.create('/admin/settings');
    const button = Array.from(
      harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('header button') ?? [],
    ).find((element) => element.textContent?.includes('Sign out'));
    expect(button).toBeDefined();
    button?.click();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(null, {
      status,
      statusText: 'Response',
    });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(TestBed.inject(AuthSession).user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
