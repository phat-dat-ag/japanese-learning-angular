import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AuthSession } from '../../../core/auth/auth-session.service';

@Component({ template: 'Destination' })
class Destination { }

const path = '/admin/kanji-quiz/questions';

describe('Kanji Quiz Question Bank routing', () => {
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

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(() => true);
    http.verify();
  });

  function signIn(role: string): void {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'id', username: 'Account', role });
  }

  it('loads the page shell directly for Admin with active navigation and no API requests', async () => {
    signIn('Admin');
    const harness = await RouterTestingHarness.create(path);
    const page = harness.routeNativeElement;
    expect(TestBed.inject(Router).url).toBe(path);
    expect(page?.querySelector('h1')?.textContent).toBe('Kanji Quiz Question Bank');
    expect(page?.querySelector('header')?.textContent).toContain('Kanji Quiz Question Bank');
    expect(page?.querySelector('main')?.textContent).toContain('coming soon');
    expect(page?.querySelector('main form, main table, main input')).toBeNull();
    expect(page?.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe(path);
  });

  it('opens from Admin navigation and returns to the dashboard', async () => {
    signIn('Admin');
    const harness = await RouterTestingHarness.create('/admin');
    const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
      'nav a[href="' + path + '"]',
    );
    expect(link?.textContent).toContain('Kanji Quiz Question Bank');
    link?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe(path);
    harness.routeNativeElement?.querySelector<HTMLAnchorElement>('main a[href="/admin"]')?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin');
  });

  it('redirects guests to login without exposing Admin navigation', async () => {
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
  });

  it.each(['User', 'admin'])('blocks role %s and hides the Admin entry', async (role) => {
    signIn(role);
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/flashcards');
    expect(harness.routeNativeElement?.querySelector('a[href="' + path + '"]')).toBeNull();
  });

  it('rechecks authorization when entering the question bank from an active Admin shell', async () => {
    signIn('Admin');
    const harness = await RouterTestingHarness.create('/admin');
    signIn('User');
    await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/flashcards');
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
  });

  it('blocks navigation during logout even when Admin user data remains', async () => {
    signIn('Admin');
    TestBed.inject(AuthSession).ending.set(true);
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
  });
});
