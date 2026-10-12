import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { routes } from '../../../app.routes';
import { API_CONFIG } from '../../../core/api/api.config';
import { isRecord } from '../../../core/api/api-response.model';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { QuizQuestionCreateRequest } from '../../admin/kanji-quiz/models/quiz-question.model';
import { QuestionEditor } from '../../admin/kanji-quiz/pages/question-editor';
import { QuestionImport } from '../../admin/kanji-quiz/pages/question-import';
import { QuizQuestionService } from '../../admin/kanji-quiz/services/quiz-question.service';
import { GameSetup } from '../pages/game-setup';
import { Gameplay } from '../pages/gameplay';
import { QuizHistory } from '../pages/quiz-history';
import { QuizProgress } from '../pages/quiz-progress';
import { QuizResults } from '../pages/quiz-results';
import { QuizPlayerService } from '../services/quiz-player.service';

// Only scripts/verify-kanji-quiz.mjs supplies this setting, after provisioning an isolated DB.
// Ordinary unit-test runs skip the suite and never contact a backend.
const runtime: unknown = Reflect.get(globalThis, 'process');
const environment = isRecord(runtime) && isRecord(runtime['env']) ? runtime['env'] : {};
const value = environment['KANJI_QUIZ_ISOLATED_TEST'];
const setting = typeof value === 'string' ? value : undefined;
function configuration() {
  const value: unknown = JSON.parse(setting ?? 'null');
  if (!isRecord(value))
    throw new Error('Run npm run test:quiz:live to provision isolated fixtures.');
  const baseUrl = value['baseUrl'];
  const runId = value['runId'];
  if (
    typeof baseUrl !== 'string' ||
    !/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(baseUrl) ||
    typeof runId !== 'string' ||
    !/^angular-quiz-[\da-f-]{36}$/.test(runId)
  ) {
    throw new Error(
      'Live tests require the isolated runner; external backend targets are not supported.',
    );
  }
  const token = (name: string): string => {
    const result = value[name];
    if (typeof result !== 'string') throw new Error('Missing isolated test credential.');
    return result;
  };
  return { baseUrl, runId, token };
}

function custom(sentenceReading: string, assigned = false): QuizQuestionCreateRequest {
  return {
    content: {
      sourceType: 'CUSTOM',
      sentenceReading,
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
      levelIds: assigned ? [1] : [],
      lessonIds: assigned ? [9001] : [],
      explanationEn: 'School is written 学校.',
    },
    options: ['学校', '学生', '先生', '大学'].map((text, index) => ({
      text,
      correct: index === 0,
    })),
  };
}

function component<T>(harness: RouterTestingHarness, type: Type<T>): T {
  const element = harness.fixture.debugElement.query(By.directive(type));
  if (!element) throw new Error(`Expected routed component ${type.name}.`);
  return element.injector.get(type);
}

async function settled(harness: RouterTestingHarness): Promise<void> {
  await harness.fixture.whenStable();
  harness.detectChanges();
}

function click(harness: RouterTestingHarness, label: string): void {
  const buttons = harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [];
  const button = Array.from(buttons).find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
}

describe.skipIf(!setting)('Kanji Quiz against isolated real Quarkus/MySQL', () => {
  let config: ReturnType<typeof configuration>;
  let admin: QuizQuestionService;
  let player: QuizPlayerService;

  function signIn(name: 'admin' | 'player' | 'foreign') {
    const session = TestBed.inject(AuthSession);
    session.replace({
      accessToken: config.token(name),
      refreshToken: 'unused-test-token',
      expiresIn: 3600,
    });
    session.setUser({
      userId: `${config.runId}-${name}`,
      username: 'Integration learner',
      role: name === 'admin' ? 'Admin' : 'User',
    });
  }

  beforeEach(() => {
    config = configuration();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        // Node fetch serializes jsdom FormData as text. XHR uses jsdom's real multipart transport.
        provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
        { provide: API_CONFIG, useValue: { baseUrl: config.baseUrl, timeoutMs: 15_000 } },
      ],
    });
    admin = TestBed.inject(QuizQuestionService);
    player = TestBed.inject(QuizPlayerService);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('creates CUSTOM and EXAMPLE questions, edits all options, handles stale versions and lifecycle actions', async () => {
    signIn('admin');
    const harness = await RouterTestingHarness.create('/admin/kanji-quiz/questions/new');
    await settled(harness);
    const editor = component(harness, QuestionEditor);
    const request = custom('😀がっこうへいく。');
    editor.save(request);
    editor.save(request);
    await settled(harness);
    expect(editor.saveState().status).toBe('saved');
    const created = editor.created();
    if (!created) throw new Error('CUSTOM creation failed.');
    expect(created.options).toHaveLength(4);
    await harness.navigateByUrl(`/admin/kanji-quiz/questions/${created.id}/edit`);
    await settled(harness);
    const edit = component(harness, QuestionEditor);
    for (const [index, option] of created.options.entries()) {
      edit.updateOption({
        optionId: option.id,
        text: ['学校改', '学生改', '先生改', '大学改'][index],
      });
      await settled(harness);
      expect(edit.saveState().status).toBe('idle');
    }
    edit.changeCorrectOption(created.options[1].id);
    await settled(harness);
    expect((await firstValueFrom(admin.getQuestion(created.id))).data.options[1].correct).toBe(
      true,
    );
    edit.lifecycle('publish');
    await settled(harness);
    expect((await firstValueFrom(admin.getQuestion(created.id))).data.status).toBe('PUBLISHED');
    await expect(
      firstValueFrom(
        admin.updateOption(created.id, created.options[0].id, {
          version: created.version,
          text: 'Stale',
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    // A second admin advances the version; the editor must show a reloadable conflict.
    const current = (await firstValueFrom(admin.getQuestion(created.id))).data;
    await firstValueFrom(
      admin.updateOption(created.id, created.options[0].id, {
        version: current.version,
        text: '学校最新',
      }),
    );
    edit.lifecycle('unpublish');
    await settled(harness);
    expect(edit.saveState().status).toBe('conflict');
    edit.reloadQuestion();
    await settled(harness);
    edit.lifecycle('publish');
    await settled(harness);
    edit.lifecycle('unpublish');
    await settled(harness);
    expect((await firstValueFrom(admin.getQuestion(created.id))).data.status).toBe('DRAFT');
    edit.lifecycle('archive');
    await settled(harness);
    expect((await firstValueFrom(admin.getQuestion(created.id))).data.status).toBe('ARCHIVED');

    const example = (
      await firstValueFrom(
        admin.createQuestion({
          content: {
            sourceType: 'EXAMPLE',
            exampleId: 9001,
            targetStart: 0,
            targetLength: 4,
            targetReading: 'がっこう',
            levelIds: [1],
            lessonIds: [9001],
          },
          options: request.options,
        }),
      )
    ).data;
    expect(example.sourceType).toBe('EXAMPLE');
    expect(example.exampleId).toBe(9001);
    const published = (
      await firstValueFrom(admin.publishQuestion(example.id, { version: example.version }))
    ).data;
    expect(published.eligibleForNewGames).toBe(true);
    await firstValueFrom(admin.archiveQuestion(example.id, { version: published.version }));
  }, 60_000);

  it('previews a real JSON File, uploads multipart once, and renders partial success from backend validation', async () => {
    signIn('admin');
    const harness = await RouterTestingHarness.create('/admin/kanji-quiz/questions/import');
    const page = component(harness, QuestionImport);
    const valid = custom('😀がっこうでまなぶ。');
    const missingReference = {
      ...custom('😀がっこうでよむ。'),
      content: {
        ...custom('😀がっこうでよむ。').content,
        lessonIds: [999999],
      },
    };
    const file = new File([JSON.stringify([valid, missingReference])], 'questions.json', {
      type: 'application/json',
    });
    const input = harness.routeNativeElement?.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) throw new Error('Missing file input.');
    Object.defineProperty(input, 'files', {
      value: { item: (index: number) => (index === 0 ? file : null) },
    });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(page.state().status).toBe('ready'));
    await settled(harness);
    expect(page.invalidCount()).toBe(0);
    expect(page.canSubmit()).toBe(true);
    page.submit();
    page.submit();
    await settled(harness);
    expect(page.importState().status).toBe('complete');
    expect(page.outcome()?.data).toMatchObject({ total: 2, imported: 1, failed: 1 });
    expect(page.resultsByIndex().get(0)?.status).toBe('IMPORTED');
    expect(page.resultsByIndex().get(1)?.status).toBe('FAILED');
    expect(harness.routeNativeElement?.textContent).toContain('IMPORTED');
    expect(harness.routeNativeElement?.textContent).toContain('FAILED');
  }, 30_000);

  it('plays filtered and unassigned sessions through real routes, restores snapshots, and renders results/history/progress', async () => {
    signIn('admin');
    const bank = [];
    const requests: QuizQuestionCreateRequest[] = [
      custom('😀がっこうへかよう。', true),
      custom('😀がっこうからかえる。'),
      {
        content: {
          sourceType: 'EXAMPLE',
          exampleId: 9002,
          targetStart: 0,
          targetLength: 4,
          targetReading: 'がっこう',
          levelIds: [1],
          lessonIds: [9002],
        },
        options: custom('unused').options,
      },
    ];
    for (const request of requests) {
      const draft = (await firstValueFrom(admin.createQuestion(request))).data;
      bank.push(
        (await firstValueFrom(admin.publishQuestion(draft.id, { version: draft.version }))).data,
      );
    }
    signIn('player');
    const baseline = (await firstValueFrom(player.getProgress())).data;
    const harness = await RouterTestingHarness.create('/kanji-quiz');
    await settled(harness);
    const setup = component(harness, GameSetup);
    expect(setup.state().status).toBe('loaded');
    setup.selectLevel(1);
    setup.lessonId.set(9001);
    expect(setup.availableCount()).toBe(1);
    setup.startGame();
    setup.startGame();
    await settled(harness);
    const firstSession = setup.createdSessionId();
    if (!firstSession) throw new Error('Filtered session was not created.');
    const game = component(harness, Gameplay);
    expect(game.state().status).toBe('question');
    expect(game.sentence()).toMatchObject({ before: '😀', target: 'がっこう' });
    expect(harness.routeNativeElement?.querySelector('mark')?.textContent?.trim()).toBe('がっこう');
    expect(harness.routeNativeElement?.querySelectorAll('input[type=radio]').length).toBe(4);
    const first = game.questionState()?.question;
    if (!first) throw new Error('Missing first question.');
    expect(first).not.toHaveProperty('correctOptionId');
    for (const option of first.options) expect(option).not.toHaveProperty('correct');
    expect(harness.routeNativeElement?.textContent).not.toContain('Correct answer');
    // Editing a published bank question must not rewrite an already assigned snapshot.
    signIn('admin');
    const updated = (
      await firstValueFrom(
        admin.updateQuestion(bank[0].id, {
          version: bank[0].version,
          content: { ...requests[0].content, explanationEn: 'Changed after snapshot.' },
        }),
      )
    ).data;
    expect(updated.status).toBe('DRAFT');
    await firstValueFrom(admin.publishQuestion(updated.id, { version: updated.version }));
    signIn('player');
    await expect(firstValueFrom(player.finishSession(firstSession))).rejects.toMatchObject({
      status: 409,
    });
    await harness.navigateByUrl(`/kanji-quiz/sessions/${firstSession}/results`);
    await settled(harness);
    expect(component(harness, QuizResults).state().status).toBe('incomplete');
    // Recreate the gameplay component using only the URL; no in-memory question state survives.
    await harness.navigateByUrl(`/kanji-quiz/sessions/${firstSession}`);
    await settled(harness);
    const restored = component(harness, Gameplay);
    expect(restored.questionState()?.question).toEqual(first);
    const correct = first.options.find((option) => option.text === '学校');
    if (!correct) throw new Error('Missing fixture answer.');
    restored.selectOption(correct.id);
    click(harness, 'Submit answer');
    restored.submitAnswer();
    await settled(harness);
    expect(restored.questionState()?.feedback?.correct).toBe(true);
    expect(restored.questionState()?.feedback?.explanationEn).toBe('School is written 学校.');
    expect(harness.routeNativeElement?.textContent).toContain('Correct!');
    await expect(
      firstValueFrom(
        player.submitAnswer(firstSession, {
          sessionQuestionId: first.sessionQuestionId,
          selectedOptionId: correct.id,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    click(harness, 'Continue to finish');
    await settled(harness);
    expect(restored.state().status).toBe('empty');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    click(harness, 'Finish Game');
    expect(restored.state().status).toBe('empty');
    click(harness, 'Finish Game');
    restored.finishGame();
    await settled(harness);
    expect(TestBed.inject(Router).url).toBe(`/kanji-quiz/sessions/${firstSession}/results`);
    expect(component(harness, QuizResults).state().status).toBe('loaded');
    expect(harness.routeNativeElement?.textContent).toContain('学校');
    await expect(firstValueFrom(player.finishSession(firstSession))).rejects.toMatchObject({
      status: 409,
    });

    // The second game includes both classifications and advances without repeating a question.
    const secondSession = (await firstValueFrom(player.createSession({ questionCount: 3 }))).data
      .sessionId;
    await harness.navigateByUrl(`/kanji-quiz/sessions/${secondSession}`);
    await settled(harness);
    const secondGame = component(harness, Gameplay);
    const seen = new Set<number>();
    for (let index = 0; index < 3; index++) {
      const question = secondGame.questionState()?.question;
      if (!question) throw new Error('Expected next question.');
      expect(seen.has(question.sessionQuestionId)).toBe(false);
      seen.add(question.sessionQuestionId);
      const wrong = question.options.find((option) => option.text === '先生');
      if (!wrong) throw new Error('Missing distractor.');
      secondGame.selectOption(wrong.id);
      secondGame.submitAnswer();
      secondGame.submitAnswer();
      await settled(harness);
      expect(secondGame.questionState()?.feedback?.correct).toBe(false);
      expect(harness.routeNativeElement?.textContent).toContain('Incorrect.');
      secondGame.nextQuestion();
      secondGame.nextQuestion();
      await settled(harness);
    }
    secondGame.finishGame();
    await settled(harness);
    const review = component(harness, QuizResults).state();
    expect(review.status).toBe('loaded');
    if (review.status !== 'loaded') throw new Error('Results failed to load.');
    expect(review.data.questions).toHaveLength(3);
    expect(review.data.session).toMatchObject({ correctCount: 0, incorrectCount: 3 });
    for (const question of review.data.questions) {
      expect(question.options.find((option) => option.id === question.selectedOptionId)?.text).toBe(
        '先生',
      );
      expect(question.options.find((option) => option.id === question.correctOptionId)?.text).toBe(
        '学校',
      );
    }
    await harness.navigateByUrl('/kanji-quiz/history?page=0&size=1');
    await settled(harness);
    const history = component(harness, QuizHistory).state();
    if (history.status !== 'loaded') throw new Error('History failed to load.');
    expect(history.data.items[0].sessionId).toBe(secondSession);
    await harness.navigateByUrl('/kanji-quiz/history?page=1&size=1');
    await settled(harness);
    const nextPage = component(harness, QuizHistory).state();
    if (nextPage.status !== 'loaded') throw new Error('History page failed to load.');
    expect(nextPage.data.items[0].sessionId).toBe(firstSession);
    await harness.navigateByUrl(`/kanji-quiz/sessions/${firstSession}/results`);
    await settled(harness);
    expect(component(harness, QuizResults).state().status).toBe('loaded');
    await harness.navigateByUrl('/kanji-quiz/progress');
    await settled(harness);
    const progress = component(harness, QuizProgress);
    const overall = progress.overall();
    const breakdown = progress.breakdown();
    if (overall.status !== 'loaded' || breakdown.status !== 'loaded')
      throw new Error('Progress failed to load.');
    expect(overall.data.completedSessions).toBe(baseline.completedSessions + 2);
    expect(overall.data.answeredCount).toBe(baseline.answeredCount + 4);
    for (const dimension of [breakdown.data.levels, breakdown.data.lessons]) {
      expect(dimension.map((bucket) => bucket.classification)).toEqual(
        expect.arrayContaining(['ASSIGNED', 'UNASSIGNED', 'UNKNOWN']),
      );
      expect(dimension.find((bucket) => bucket.classification === 'UNKNOWN')?.answeredCount).toBe(
        1,
      );
      expect(
        dimension.find((bucket) => bucket.classification === 'UNASSIGNED')?.answeredCount,
      ).toBe(1);
    }
    expect(harness.routeNativeElement?.textContent).toContain('UNKNOWN');
    expect(harness.routeNativeElement?.textContent).toContain('UNASSIGNED');
  }, 60_000);

  it('enforces real JWT roles, issuer audience/expiry and ownership, including an Admin reading a foreign session', async () => {
    // Raw read-only requests cover rejected JWTs without invoking the separate .NET refresh API.
    for (const [token, path, status] of [
      ['', '/v1/kanji-quiz/config', 401],
      ['expired', '/v1/kanji-quiz/config', 401],
      ['wrongAudience', '/v1/kanji-quiz/config', 401],
      ['wrongIssuer', '/v1/kanji-quiz/config', 401],
      ['wrongRole', '/v1/kanji-quiz/config', 403],
      ['player', '/v1/admin/kanji-quiz/questions', 403],
      ['foreign', '/v1/kanji-quiz/sessions/9001', 404],
      ['admin', '/v1/kanji-quiz/history/9001', 404],
    ] as const) {
      const response = await fetch(config.baseUrl + path, {
        headers: token ? { Authorization: `Bearer ${config.token(token)}` } : {},
      });
      expect(response.status, `${token || 'anonymous'} ${path}`).toBe(status);
    }
    signIn('foreign');
    const harness = await RouterTestingHarness.create('/kanji-quiz/sessions/9001/results');
    await settled(harness);
    expect(component(harness, QuizResults).state()).toMatchObject({
      status: 'error',
      retryable: false,
    });
    await harness.navigateByUrl('/kanji-quiz/history');
    await settled(harness);
    const history = component(harness, QuizHistory).state();
    if (history.status !== 'loaded') throw new Error('Empty history failed to load.');
    expect(history.data.items).toEqual([]);
    await harness.navigateByUrl('/kanji-quiz/progress');
    await settled(harness);
    expect(component(harness, QuizProgress).overall()).toMatchObject({
      status: 'loaded',
      data: { completedSessions: 0 },
    });
    expect(component(harness, QuizProgress).breakdown()).toMatchObject({
      status: 'loaded',
      data: { levels: [], lessons: [] },
    });
    TestBed.inject(AuthSession).clear();
    await settled(harness);
    expect(TestBed.inject(Router).url).toBe('/login');
  }, 30_000);
});
