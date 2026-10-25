import { test, expect } from '@playwright/test';

// Browser interaction coverage without a backend. Wire shapes match the contract fixtures;
// scheduling/concurrency are verified separately against Quarkus by the live scenario.
test('keyboard review, uncertain delivery, refresh sign-in, bookmarks and abandonment', async ({
  page,
}) => {
  const now = '2026-10-25T00:00:00Z';
  let progress = {
    status: 'NEW',
    successfulRepetitionCount: 0,
    lapseCount: 0,
    intervalSeconds: 0,
    easeFactor: 2.5,
    version: 0,
  };
  let bookmarked = false;
  let attempts = 0;
  let practiceAttempts = 0;
  let nextId = 1;
  let loseResponse = true;
  const sessions = new Map();
  const accepted = new Map();
  const reviewRequests = [];
  const envelope = (data) => ({
    success: true,
    data,
    meta: { timestamp: now, traceId: 'browser-test', correlationId: 'browser-test' },
  });
  const personal = () => ({ id: 7, word: 'Vocabulary', progress, bookmarked });
  const detail = () => ({
    vocabulary: { id: 7, word: 'Vocabulary', normalizedWord: 'Vocabulary' },
    readings: [],
    meanings: [
      { meaningId: 1, displayOrder: 0, languageCode: 'en', meaning: 'Meaning', isPrimary: true },
    ],
    partsOfSpeech: [],
    levels: [],
    lessons: [
      {
        lessonId: 12,
        assignmentDisplayOrder: 0,
        levelCode: 'N5',
        levelName: 'JLPT N5',
        lessonNumber: 1,
        title: 'First lesson',
        displayOrder: 0,
      },
    ],
    kanji: [],
    examples: [],
    progress,
    bookmarked,
  });
  const sessionDetail = (session) => ({
    ...session,
    items: session.items.map((item) => ({ ...item, progress })),
  });
  const collection = (items) => ({
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : undefined;
    const send = (data) => route.fulfill({ json: envelope(data) });
    if (path === '/api/auth/login')
      return route.fulfill({
        json: { accessToken: 'test-access', refreshToken: 'test-refresh', expiresIn: 3600 },
      });
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          userId: 'test-user',
          username: 'Learner',
          email: 'learner@example.test',
          role: 'User',
        },
      });
    if (path === '/api/v1/jlpt-levels') return send([{ code: 'N5', name: 'JLPT N5' }]);
    if (path === '/api/v1/lessons')
      return send([{ id: 12, lessonNumber: 1, title: 'First lesson' }]);
    const root = '/api/v1/flashcards';
    if (path === root) {
      expect(new URL(request.url()).searchParams.get('lesson')).toBe('1');
      return send({
        flashcardItems: [personal()],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path === `${root}/7`) return send(detail());
    if (path === `${root}/7/bookmark`) {
      bookmarked = request.method() === 'PUT';
      return send({ vocabularyId: 7, bookmarked });
    }
    if (path === `${root}/bookmarks`) return send(collection(bookmarked ? [personal()] : []));
    if (path === `${root}/reviews/due`) return send(collection([]));
    if (path === `${root}/reviews/forgotten`)
      return send(collection(practiceAttempts ? [personal()] : []));
    if (path === `${root}/statistics`)
      return send({
        totalVocabularyCount: 1,
        newCount: progress.version ? 0 : 1,
        learningCount: progress.version ? 1 : 0,
        reviewCount: 0,
        masteredCount: 0,
        dueCount: 0,
        studiedCount: attempts ? 1 : 0,
        totalReviewAttempts: attempts,
        rememberedCount: attempts - practiceAttempts,
        forgottenCount: practiceAttempts,
        scheduledReviewAttempts: attempts - practiceAttempts,
        practiceReviewAttempts: practiceAttempts,
        studiedPercentage: attempts ? 100 : 0,
        masteryPercentage: 0,
      });
    if (path === `${root}/sessions`) {
      if (request.method() === 'GET')
        return send(
          collection(
            [...sessions.values()]
              .filter((s) => s.status === 'IN_PROGRESS')
              .map(({ items, ...summary }) => summary),
          ),
        );
      expect(body.lessonId).toBe(12);
      expect(body.userId).toBeUndefined();
      if (body.mode === 'DUE') return send({ outcome: 'NO_ELIGIBLE_CARDS', eligibleCount: 0 });
      const session = {
        sessionId: nextId++,
        lessonId: 12,
        mode: body.mode,
        status: 'IN_PROGRESS',
        itemCount: 1,
        completedCount: 0,
        currentPosition: 0,
        createdAt: now,
        items: [{ itemId: nextId * 10, vocabularyId: 7, position: 0, progress }],
      };
      sessions.set(session.sessionId, session);
      return send({ outcome: 'CREATED', eligibleCount: 1, session });
    }
    const match = path.match(/\/sessions\/(\d+)(.*)$/);
    if (match) {
      const session = sessions.get(Number(match[1]));
      if (!match[2]) return send(sessionDetail(session));
      if (match[2] === '/abandon') {
        session.status = 'ABANDONED';
        session.abandonedAt = now;
        return send(sessionDetail(session));
      }
      if (match[2].endsWith('/review')) {
        reviewRequests.push(body);
        const prior = accepted.get(session.sessionId);
        if (prior) {
          expect(body).toEqual(prior.request);
          return send(prior.response);
        }
        attempts++;
        if (session.mode === 'ALL') practiceAttempts++;
        else
          progress = {
            ...progress,
            status: 'LEARNING',
            version: progress.version + 1,
            successfulRepetitionCount: 1,
            intervalSeconds: 86400,
            lastReviewedAt: now,
            nextReviewAt: '2026-10-26T00:00:00Z',
          };
        session.status = 'COMPLETED';
        session.completedCount = 1;
        session.currentPosition = 1;
        session.completedAt = now;
        session.items[0].completedAt = now;
        const response = {
          reviewId: attempts,
          sessionItemId: session.items[0].itemId,
          vocabularyId: 7,
          rating: body.rating,
          scheduling: session.mode !== 'ALL',
          progress,
          reviewedAt: now,
        };
        accepted.set(session.sessionId, { request: body, response });
        if (loseResponse) {
          loseResponse = false;
          return route.abort('failed');
        }
        return send(response);
      }
    }
    return route.fulfill({
      status: 404,
      json: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Missing test route', details: [] },
        meta: envelope(null).meta,
      },
    });
  });
  const signIn = async () => {
    await page.getByLabel('Email', { exact: true }).fill('learner@example.test');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  const link = async (href) => page.locator(`a[href="${href}"]`).first().click();
  const setup = async () => {
    await link('/flashcards');
    await link('/flashcards/n5');
    await link('/flashcards/n5/lessons/12');
    await link('/flashcards/learn/12');
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await signIn();
  await setup();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page).toHaveURL(/\/flashcards\/sessions\/1$/);
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bookmark', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const reveal = page.getByRole('button', { name: 'Reveal meanings', exact: true });
  await reveal.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'GOOD', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry original GOOD rating' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'EASY', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry original GOOD rating' }).click();
  await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();
  expect(reviewRequests).toEqual([
    { rating: 'GOOD', expectedProgressVersion: 0 },
    { rating: 'GOOD', expectedProgressVersion: 0 },
  ]);
  await page.reload();
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await signIn();
  await expect(page).toHaveURL(/\/flashcards\/sessions\/1$/);
  await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();
  await link('/flashcards/bookmarks');
  await page.getByRole('button', { name: 'Remove bookmark', exact: true }).click();
  await expect(page.getByText('No vocabulary in this collection.')).toBeVisible();
  await setup();
  await page.getByLabel('Mode', { exact: true }).selectOption('DUE');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByText('No eligible cards.', { exact: false })).toBeVisible();
  await page.getByLabel('Mode', { exact: true }).selectOption('ALL');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal meanings', exact: true }).click();
  await page.getByRole('button', { name: 'AGAIN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();
  await link('/flashcards/statistics');
  await expect(page.getByText('Studied 100%')).toBeVisible();
  await expect(page.getByText('Mastered 0%')).toBeVisible();
  await setup();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Abandon session…', exact: true }).click();
  await page.getByRole('button', { name: 'Abandon session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session abandoned' })).toBeVisible();
  expect(attempts).toBe(2);
});
