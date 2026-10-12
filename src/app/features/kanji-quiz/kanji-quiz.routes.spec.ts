import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSession } from '../../core/auth/auth-session.service';
import { QuizPlayerService } from './services/quiz-player.service';
import { session, nextQuestion } from './testing/quiz-gameplay.fixture';
import { historyDetail, historyPage, progress, breakdown } from './testing/quiz-report.fixture';
import { config, success } from './testing/quiz-player.fixture';

describe('Kanji Quiz player routing', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: QuizPlayerService,
          useValue: {
            getConfig: () => of(success(config)),
            getHistory: (page = 0, size = 20) =>
              of(success({ ...historyPage, page, size, totalElements: 41, totalPages: 3 })),
            getHistoryDetail: (id: number) =>
              of(
                success({ ...historyDetail, session: { ...historyDetail.session, sessionId: id } }),
              ),
            getProgress: () => of(success(progress)),
            getProgressBreakdown: () => of(success(breakdown)),
            getSession: (id: number) => of(success({ ...session, sessionId: id })),
            getNextQuestion: (id: number) => of(success({ ...nextQuestion, sessionId: id })),
          },
        },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function signIn(role = 'User'): void {
    const session = TestBed.inject(AuthSession);
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({ userId: 'user', username: 'Learner', role });
  }

  it.each([
    '/kanji-quiz',
    '/kanji-quiz/sessions/42',
    '/kanji-quiz/sessions/42/results',
    '/kanji-quiz/history',
    '/kanji-quiz/progress',
  ])('protects anonymous access to %s', async (url) => {
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it.each([
    '/kanji-quiz',
    '/kanji-quiz/sessions/42',
    '/kanji-quiz/sessions/42/results',
    '/kanji-quiz/history',
    '/kanji-quiz/progress',
  ])('preserves Admin separation for %s', async (url) => {
    signIn('Admin');
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/admin');
  });

  it('shows the player entry point and setup for a User', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz');
    expect(harness.routeNativeElement?.querySelector('a[href="/kanji-quiz"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Game Setup');
  });

  it('preserves a deep-linked session ID and reacts to route parameter changes', async () => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/42');
    expect(harness.routeNativeElement?.textContent).toContain('Session 42');
    await harness.navigateByUrl('/kanji-quiz/sessions/73');
    expect(harness.routeNativeElement?.textContent).toContain('Session 73');
    expect(harness.routeNativeElement?.textContent).toContain('Choose the kanji');
  });

  it.each(['0', '-1', 'abc', '9007199254740992'])('handles invalid session ID %s', async (id) => {
    signIn();
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/' + id);
    expect(harness.routeNativeElement?.textContent).toContain('Invalid session ID');
  });
  it('opens protected results directly and reacts to session ID changes', async () => {
    signIn();
    vi.spyOn(TestBed.inject(QuizPlayerService), 'getSession').mockImplementation((id) =>
      of(success({ ...session, sessionId: id, status: 'COMPLETED' as const, answeredCount: 2 })),
    );
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/42/results');
    expect(harness.routeNativeElement?.textContent).toContain('Question review');
    await harness.navigateByUrl('/kanji-quiz/sessions/73/results');
    expect(harness.routeNativeElement?.textContent).toContain('Session 73');
  });

  it.each([
    ['/kanji-quiz/history', 'Quiz History'],
    ['/kanji-quiz/progress', 'Learning Progress'],
  ])('opens %s for a User and exposes player navigation', async (url, title) => {
    signIn();
    const harness = await RouterTestingHarness.create(url);
    expect(harness.routeNativeElement?.textContent).toContain(title);
    expect(
      harness.routeNativeElement?.querySelector('a[href="/kanji-quiz/history"]'),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('a[href="/kanji-quiz/progress"]'),
    ).not.toBeNull();
  });
  it('navigates history pages through the rendered Next link', async () => {
    signIn();
    const history = vi.spyOn(TestBed.inject(QuizPlayerService), 'getHistory');
    const harness = await RouterTestingHarness.create('/kanji-quiz/history');
    const next = Array.from(
      harness.routeNativeElement?.querySelectorAll<HTMLAnchorElement>('a') ?? [],
    ).find((link) => link.textContent?.trim() === 'Next');
    expect(next).toBeDefined();
    next?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(TestBed.inject(Router).url).toBe('/kanji-quiz/history?page=1&size=20');
    expect(history).toHaveBeenLastCalledWith(1, 20);
  });
});
