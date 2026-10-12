import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { config, created, meta, success } from '../testing/quiz-player.fixture';
import { GameSetup } from './game-setup';

describe('GameSetup', () => {
  let fixture: ComponentFixture<GameSetup>;
  let page: GameSetup;
  let http: HttpTestingController;
  const base = '/api/v1/kanji-quiz';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(GameSetup);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  function load(data = config): void {
    http.expectOne(base + '/config').flush(success(data));
    fixture.detectChanges();
  }
  function failure(code: string, status = 409): void {
    http.expectOne(base + '/sessions').flush(
      {
        success: false,
        error: { code, message: 'Internal detail must not be rendered', details: [] },
        meta,
      },
      { status, statusText: 'Failure' },
    );
    fixture.detectChanges();
  }

  it('renders loading then backend-provided configuration', () => {
    expect(fixture.nativeElement.textContent).toContain('Loading quiz configuration');
    load();
    expect(fixture.nativeElement.textContent).toContain('JLPT N5');
    expect(fixture.nativeElement.textContent).toContain('First lesson');
    expect(page.maximumCount()).toBe(12);
  });

  it('shows configuration failure and retries through the UI', () => {
    http.expectOne(base + '/config').flush(null, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load');
    fixture.nativeElement.querySelector('button').click();
    load();
    expect(page.state().status).toBe('loaded');
  });

  it('shows a refreshable empty bank without a start action', () => {
    load({ ...config, totalQuestions: 0, levels: [], lessons: [] });
    expect(fixture.nativeElement.textContent).toContain('No playable questions');
    expect(fixture.nativeElement.querySelector('button[type=submit]')).toBeNull();
    fixture.nativeElement.querySelector('button').click();
    load();
  });

  it('allows unclassified questions when no classifications are available', () => {
    load({ ...config, levels: [], lessons: [] });
    expect(page.validation()).toBe('');
    expect(page.availableCount()).toBe(12);
  });

  it('selects filters through the UI and clears a lesson incompatible with a new level', async () => {
    load();
    await fixture.whenStable();
    const level: HTMLSelectElement = fixture.nativeElement.querySelector('#level');
    level.selectedIndex = 1;
    level.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.levelId()).toBe(1);
    expect(page.lessons().map((lesson) => lesson.id)).toEqual([10]);
    const lesson: HTMLSelectElement = fixture.nativeElement.querySelector('#lesson');
    lesson.selectedIndex = 1;
    lesson.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.lessonId()).toBe(10);
    expect(page.maximumCount()).toBe(3);
    page.selectLevel(2);
    expect(page.lessonId()).toBeNull();
    expect(page.maximumCount()).toBe(4);
  });

  it.each([null, 0, -1, 1.5, 13, NaN])(
    'blocks invalid count %s with a visible message',
    (count) => {
      load();
      page.questionCount.set(count);
      page.startGame();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Enter a whole number');
      http.expectNone(base + '/sessions');
    },
  );

  it('enforces the backend maximum and rejects stale or mismatched selections', () => {
    load({ ...config, maxQuestionCount: 2 });
    page.questionCount.set(3);
    expect(page.validation()).toContain('1 to 2');
    page.levelId.set(999);
    expect(page.validation()).toContain('available JLPT level');
    page.levelId.set(1);
    page.lessonId.set(20);
    page.startGame();
    expect(page.validation()).toContain('belonging');
    http.expectNone(base + '/sessions');
  });

  it('posts selected filters once and navigates with the committed session ID', async () => {
    load();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.selectLevel(1);
    page.lessonId.set(10);
    page.questionCount.set(3);
    page.startGame();
    page.startGame();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    const request = http.expectOne(base + '/sessions');
    expect(request.request.body).toEqual({ levelId: 1, lessonId: 10, questionCount: 3 });
    request.flush(success({ ...created, questionCount: 3 }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/kanji-quiz', 'sessions', 42]);
    page.startGame();
    http.expectNone(base + '/sessions');
  });

  it('preserves a created session when navigation fails and never creates it again', async () => {
    load();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockRejectedValue(new Error('Navigation failed'));
    page.startGame();
    http.expectOne(base + '/sessions').flush(success(created));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe(
      '/kanji-quiz/sessions/42',
    );
    page.startGame();
    http.expectNone(base + '/sessions');
  });

  it.each([
    ['QUIZ_INSUFFICIENT_QUESTIONS', 409, 'enough matching'],
    ['QUIZ_GAME_CONFLICT', 409, 'question bank changed'],
    ['QUIZ_GAME_INVALID', 400, 'no longer valid'],
    ['UNAUTHORIZED', 401, 'sign-in has expired'],
    ['FORBIDDEN', 403, 'cannot start'],
    ['INTERNAL_ERROR', 500, 'Unable to start'],
  ])('handles %s and permits an explicit retry', (code, status, message) => {
    load();
    page.selectLevel(1);
    page.startGame();
    failure(code, status);
    expect(page.error()).toContain(message);
    expect(fixture.nativeElement.textContent).not.toContain('Internal detail');
    expect(page.levelId()).toBe(1);
    expect(page.submitting()).toBe(false);
    page.startGame();
    failure(code, status);
  });

  it('does not automatically repeat a request after a lost response', () => {
    load();
    page.startGame();
    http.expectOne(base + '/sessions').error(new ProgressEvent('error'));
    expect(page.error()).toContain('Retrying may create another session');
    http.expectNone(base + '/sessions');
  });

  it('revalidates retained filters after availability refresh', () => {
    load();
    page.selectLevel(1);
    page.retry();
    load({ ...config, levels: [config.levels[1]], lessons: [config.lessons[1]] });
    page.startGame();
    expect(page.validation()).toContain('available JLPT level');
    http.expectNone(base + '/sessions');
  });
});
