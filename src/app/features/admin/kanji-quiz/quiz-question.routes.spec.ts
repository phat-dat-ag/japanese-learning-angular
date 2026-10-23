import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { QuizQuestionService } from './services/quiz-question.service';
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
        {
          provide: QuizQuestionService,
          useValue: {
            listQuestions: () =>
              of({
                success: true,
                data: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
              }),
          },
        },
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

  it('loads the question list directly for Admin with active navigation', async () => {
    signIn('Admin');
    const harness = await RouterTestingHarness.create(path);
    const page = harness.routeNativeElement;
    expect(TestBed.inject(Router).url).toBe(path);
    expect(page?.querySelector('h1')?.textContent).toBe('Kanji Quiz Question Bank');
    expect(page?.querySelector('header')?.textContent).toContain('Kanji Quiz Question Bank');
    expect(page?.querySelector('main')?.textContent).toContain('No questions found');
    expect(page?.querySelector('form[aria-label="Question filters"]')).not.toBeNull();
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

  it.each(['/new', '/42/edit'])(
    'protects editor route %s with the existing Admin guards',
    async (suffix) => {
      const harness = await RouterTestingHarness.create(path + suffix);
      expect(TestBed.inject(Router).url).toBe('/login');
      signIn('User');
      await harness.navigateByUrl(path + suffix);
      expect(TestBed.inject(Router).url).toBe('/flashcards');
      signIn('Admin');
      if (suffix === '/new') {
        await harness.navigateByUrl(path + suffix);
        expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
          'Create Kanji Quiz Question',
        );
      }
    },
  );

  it('blocks navigation during logout even when Admin user data remains', async () => {
    signIn('Admin');
    TestBed.inject(AuthSession).ending.set(true);
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
  });
  it('opens import with the current query and returns to an unfiltered first page', async () => {
    signIn('Admin');
    const query = '?status=DRAFT&page=2&size=50&keyword=school';
    const harness = await RouterTestingHarness.create(path + query);
    const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
      'main a[href*="/questions/import"]',
    );
    expect(link).not.toBeNull();
    link!.click();
    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe(path + '/import' + query);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Kanji Quiz JSON Import Preview',
    );
    harness.routeNativeElement
      ?.querySelector<HTMLAnchorElement>('main a[href="/admin/kanji-quiz/questions"]')
      ?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(TestBed.inject(Router).url).toBe(path);
  });

  it('protects direct import preview navigation with the existing Admin guards', async () => {
    const harness = await RouterTestingHarness.create(path + '/import');
    expect(TestBed.inject(Router).url).toBe('/login');
    signIn('User');
    await harness.navigateByUrl(path + '/import');
    expect(TestBed.inject(Router).url).toBe('/flashcards');
    signIn('Admin');
    await harness.navigateByUrl(path + '/import');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Kanji Quiz JSON Import Preview',
    );
  });

});
