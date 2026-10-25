import { execFileSync } from 'node:child_process';
import { test, expect, login, navigate, paceAuth } from './fixtures.mjs';

// The shared fixture verifies development-container labels and creates fresh accounts.
// Catalogue content is read-only; cleanup touches only this run's generated subject.
function cleanLearning(subject, makeDue = false) {
  if (!/^[\da-f-]{36}$/i.test(subject)) throw new Error('Invalid fixture subject.');
  const owner = subject.toLowerCase();
  try {
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'jp_learning_dev-mysql-1',
        'sh',
        '-c',
        'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" -N -B',
      ],
      {
        // Simulate elapsed time for this disposable learner only.
        input: makeDue
          ? `UPDATE user_vocabulary_progress SET last_reviewed_at=UTC_TIMESTAMP(6)-INTERVAL 2 HOUR, next_review_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE user_subject='${owner}';`
          : `START TRANSACTION;
DELETE FROM flashcard_review_history WHERE user_subject='${owner}';
DELETE i FROM flashcard_session_items i JOIN flashcard_sessions s ON s.id=i.session_id WHERE s.user_subject='${owner}';
DELETE FROM flashcard_sessions WHERE user_subject='${owner}';
DELETE FROM user_vocabulary_progress WHERE user_subject='${owner}';
DELETE FROM user_vocabulary_bookmarks WHERE user_subject='${owner}';
COMMIT;`,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch {
    throw new Error('Unable to clean this run’s flashcard fixture; inspect development MySQL.');
  }
}

test('learning, exact retries, conflicts, bookmarks, practice and authenticated resume', async ({
  page,
  request,
  fixtures,
}) => {
  let touchedLearning = false;
  try {
    const signIn = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'));
    await login(page, fixtures.player);
    const tokens = await (await signIn).json();
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    const root = '/api/v1/flashcards';
    const readiness = await request.get(`${root}/statistics`, {
      headers: { ...headers, 'X-Correlation-ID': 'flashcard-live-statistics' },
    });
    if (readiness.status() === 404) {
      const direct = await request.get('http://localhost:8082/api/v1/flashcards/statistics', {
        headers,
      });
      console.log(
        'Statistics diagnostic: Gateway status',
        readiness.status(),
        'direct Quarkus status',
        direct.status(),
      );
    }
    expect(
      readiness.status(),
      'Gateway must deploy the Flashcard Learning API matching the checked-in OpenAPI',
    ).toBe(200);
    const lessonsResponse = await request.get('/api/v1/lessons?level=N5', { headers });
    expect(lessonsResponse.status()).toBe(200);
    let lesson;
    for (const candidate of (await lessonsResponse.json()).data) {
      const response = await request.get(
        `${root}?level=N5&lesson=${candidate.lessonNumber}&size=20&page=0`,
        { headers },
      );
      expect(response.status()).toBe(200);
      if ((await response.json()).data.totalElements >= 2) {
        lesson = candidate;
        break;
      }
    }
    test.skip(!lesson, 'Requires an existing N5 lesson with at least two words.');
    await navigate(page, '/flashcards/n5');
    const catalogue = page.waitForResponse(
      (r) =>
        r.url().includes(`${root}?lesson=${lesson.lessonNumber}&level=N5`) &&
        r.url().includes('includeLearning=true'),
    );
    await navigate(page, `/flashcards/n5/lessons/${lesson.id}`);
    const catalogueResponse = await catalogue;
    expect(catalogueResponse.status()).toBe(200);
    const catalogueData = (await catalogueResponse.json()).data;
    expect(
      catalogueData.flashcardItems[0],
      'includeLearning must return progress and bookmark state',
    ).toMatchObject({ progress: expect.any(Object), bookmarked: expect.any(Boolean) });
    await navigate(page, `/flashcards/learn/${lesson.id}`);
    await page.getByLabel('Card limit (1–100)').fill('1');
    const createdResponse = page.waitForResponse(
      (r) => r.url().endsWith(`${root}/sessions`) && r.request().method() === 'POST',
    );
    touchedLearning = true;
    await page.getByRole('button', { name: 'Start session', exact: true }).click();
    const created = (await (await createdResponse).json()).data.session;
    await expect(page).toHaveURL(new RegExp(`/flashcards/sessions/${created.sessionId}$`));
    const staleResponse = await request.post(`${root}/sessions`, {
      headers,
      data: { lessonId: lesson.id, mode: 'NEW_AND_DUE', cardLimit: 1, shuffle: false },
    });
    expect(staleResponse.status()).toBe(200);
    const stale = (await staleResponse.json()).data.session;
    expect(stale.items[0].vocabularyId).toBe(created.items[0].vocabularyId);

    await page.reload();
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    await login(page, fixtures.player);
    await expect(page).toHaveURL(new RegExp(`/flashcards/sessions/${created.sessionId}$`));
    await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Remove bookmark', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Reveal meanings', exact: true }).click();
    const ratedResponse = page.waitForResponse(
      (r) => r.url().endsWith('/review') && r.request().method() === 'PUT',
    );
    let lostReview;
    await page.route(
      '**/items/*/review',
      async (route) => {
        lostReview = route.request().postDataJSON();
        const committed = await route.fetch();
        expect(committed.status()).toBe(200);
        await route.abort('failed');
      },
      { times: 1 },
    );
    await page.getByRole('button', { name: 'GOOD', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry original GOOD rating' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry original GOOD rating' }).click();
    const accepted = (await (await ratedResponse).json()).data;
    await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();

    const rating = { rating: 'GOOD', expectedProgressVersion: created.items[0].progress.version };
    const reviewUrl = `${root}/sessions/${created.sessionId}/items/${created.items[0].itemId}/review`;
    expect(lostReview).toEqual(rating);
    const replay = await request.put(reviewUrl, { headers, data: rating });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).data.reviewId).toBe(accepted.reviewId);
    const changed = await request.put(reviewUrl, { headers, data: { ...rating, rating: 'EASY' } });
    expect(changed.status()).toBe(409);
    expect((await changed.json()).error.code).toBe('FLASHCARD_CONFLICT');
    const noLongerDue = await request.put(
      `${root}/sessions/${stale.sessionId}/items/${stale.items[0].itemId}/review`,
      { headers, data: rating },
    );
    expect(noLongerDue.status()).toBe(409);
    expect((await noLongerDue.json()).error.code).toBe('FLASHCARD_NOT_DUE');
    for (let attempt = 0; attempt < 2; attempt++) {
      const abandoned = await request.post(`${root}/sessions/${stale.sessionId}/abandon`, {
        headers,
      });
      expect(abandoned.status()).toBe(200);
      expect((await abandoned.json()).data.status).toBe('ABANDONED');
    }

    // A second real .NET identity must see none of the first learner's data.
    await paceAuth();
    const otherLogin = await request.post('/api/auth/login', {
      data: { email: fixtures.other.email, password: fixtures.other.password },
    });
    expect(otherLogin.status()).toBe(200);
    const otherHeaders = { Authorization: 'Bearer ' + (await otherLogin.json()).accessToken };
    for (const path of ['/sessions/' + created.sessionId, '/sessions/' + stale.sessionId]) {
      expect((await request.get(root + path, { headers: otherHeaders })).status()).toBe(404);
    }
    expect((await request.put(reviewUrl, { headers: otherHeaders, data: rating })).status()).toBe(
      404,
    );
    expect(
      (
        await request.post(root + '/sessions/' + stale.sessionId + '/abandon', {
          headers: otherHeaders,
        })
      ).status(),
    ).toBe(404);
    for (const path of ['/bookmarks', '/reviews/due', '/reviews/forgotten', '/sessions']) {
      const response = await request.get(root + path, { headers: otherHeaders });
      expect(response.status()).toBe(200);
      expect((await response.json()).data.totalElements).toBe(0);
    }
    const finished = await request.post(root + '/sessions/' + created.sessionId + '/finish', {
      headers,
    });
    expect(finished.status()).toBe(200);
    expect((await finished.json()).data.status).toBe('COMPLETED');
    for (const suffix of ['', '?level=N5', '?lessonId=' + lesson.id]) {
      expect((await request.get(root + '/statistics' + suffix, { headers })).status()).toBe(200);
    }
    const empty = await request.post(`${root}/sessions`, {
      headers,
      data: { lessonId: lesson.id, mode: 'DUE' },
    });
    expect((await empty.json()).data.outcome).toBe('NO_ELIGIBLE_CARDS');

    await page.reload();
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    await login(page, fixtures.player);
    await expect(page).toHaveURL(new RegExp(`/flashcards/sessions/${created.sessionId}$`));
    await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();
    await navigate(page, '/flashcards');
    await navigate(page, '/flashcards/n5');
    await navigate(page, `/flashcards/n5/lessons/${lesson.id}`);
    await navigate(page, `/flashcards/learn/${lesson.id}`);
    const practiceCreated = page.waitForResponse(
      (r) => r.url().endsWith(`${root}/sessions`) && r.request().method() === 'POST',
    );
    await page.getByLabel('Mode', { exact: true }).selectOption('ALL');
    await page.getByLabel('Card limit (1–100)').fill('1');
    await page.getByRole('button', { name: 'Start session', exact: true }).click();
    const practiceSession = (await (await practiceCreated).json()).data.session;
    await expect(page.getByText('Practice counts toward studied vocabulary')).toBeVisible();
    await page.getByRole('button', { name: 'Reveal meanings', exact: true }).click();
    const practicedResponse = page.waitForResponse((r) => r.url().endsWith('/review'));
    await page.getByRole('button', { name: 'AGAIN', exact: true }).click();
    const practiced = (await (await practicedResponse).json()).data;
    expect(practiced.scheduling).toBe(false);
    expect(practiced.progress).toEqual(practiceSession.items[0].progress);
    await expect(page.getByRole('heading', { name: 'Session completed' })).toBeVisible();
    await navigate(page, '/flashcards/review');
    await page.getByLabel('Queue', { exact: true }).selectOption('forgotten');
    await expect(
      page.locator(`a[href="/flashcards/detail/${practiced.vocabularyId}"]`),
    ).toBeVisible();
    await navigate(page, '/flashcards/bookmarks');
    await page.getByRole('button', { name: 'Remove bookmark', exact: true }).click();
    await expect(page.getByText('No vocabulary in this collection.')).toBeVisible();
    await navigate(page, '/flashcards/statistics');
    await expect(page.getByText('Practice attempts', { exact: true }).locator('..')).toContainText(
      '1',
    );
    await expect(page.getByText('Scheduled attempts', { exact: true }).locator('..')).toContainText(
      '1',
    );
    await expect(page.getByText('Accepted attempts', { exact: true }).locator('..')).toContainText(
      '2',
    );

    cleanLearning(fixtures.player.id, true);
    const dueQueue = await request.get(root + '/reviews/due', { headers });
    expect(dueQueue.status()).toBe(200);
    expect((await dueQueue.json()).data.totalElements).toBe(1);
    const dueCreated = await request.post(root + '/sessions', {
      headers,
      data: { lessonId: lesson.id, mode: 'DUE', cardLimit: 1 },
    });
    expect(dueCreated.status()).toBe(200);
    const due = (await dueCreated.json()).data.session;
    const dueUrl =
      root + '/sessions/' + due.sessionId + '/items/' + due.items[0].itemId + '/review';
    const conflict = await request.put(dueUrl, {
      headers,
      data: { rating: 'HARD', expectedProgressVersion: 0 },
    });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error.code).toBe('FLASHCARD_CONFLICT');
    const reviewedDue = await request.put(dueUrl, {
      headers,
      data: { rating: 'HARD', expectedProgressVersion: due.items[0].progress.version },
    });
    expect(reviewedDue.status()).toBe(200);
    expect(
      (await (await request.get(root + '/reviews/due', { headers })).json()).data.totalElements,
    ).toBe(0);
    await navigate(page, '/flashcards');
    await navigate(page, '/flashcards/n5');
    await navigate(page, '/flashcards/n5/lessons/' + lesson.id);
    await navigate(page, '/flashcards/learn/' + lesson.id);
    await page.getByLabel('Mode', { exact: true }).selectOption('ALL');
    await page.getByRole('button', { name: 'Start session', exact: true }).click();
    await page.getByRole('button', { name: /^Abandon session/ }).click();
    await page.getByRole('button', { name: 'Abandon session', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Session abandoned' })).toBeVisible();
  } finally {
    if (touchedLearning) cleanLearning(fixtures.player.id);
  }
});
