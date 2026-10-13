import { test, expect, login, navigate, paceAuth } from './fixtures.mjs';
const bank = '/api/v1/admin/kanji-quiz/questions';
const quiz = '/api/v1/kanji-quiz';
async function action(page, name, suffix, expectedStatus = 200) {
  if (['Publish question', 'Unpublish question'].includes(name))
    page.once('dialog', (dialog) => dialog.accept());
  const pending = page.waitForResponse(
    (r) => r.url().endsWith(suffix) && r.request().method() !== 'GET',
  );
  await page.getByRole('button', { name, exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(expectedStatus);
  return (await response.json()).data;
}
async function tokensFromLogin(page, account) {
  const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'));
  await login(page, account);
  const body = await (await response).json();
  return body.data ?? body;
}

test('anonymous deep links, gateway security and mobile login', async ({ page, request }) => {
  for (const path of [
    '/kanji-quiz',
    '/kanji-quiz/sessions/1',
    '/kanji-quiz/history',
    '/admin/kanji-quiz/questions',
  ]) {
    expect((await page.goto(path)).status()).toBe(200);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const path of [`${quiz}/config`, bank]) {
    const response = await request.get(path, {
      headers: { 'X-Correlation-ID': 'quiz-e2e-probe', Authorization: 'Bearer invalid' },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()['x-correlation-id']).toBe('quiz-e2e-probe');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['cache-control']).toBe('no-store');
  }
  for (const path of [
    '/api/v1/kanji-quiz-extra',
    '/api/v1/admin/kanji-quiz/questions-extra',
    '/.well-known/jwks.json',
    '/q/health',
  ])
    expect((await request.get(path)).status()).toBe(404);
  const cors = await request.get(`${quiz}/config`, {
    headers: { Origin: 'https://untrusted.invalid' },
  });
  expect(cors.headers()['access-control-allow-origin']).toBeUndefined();
  for (const origin of ['http://127.0.0.1:8088', 'http://127.0.0.1:8080']) {
    expect(
      (
        await request.post(origin + bank + '/import', { data: Buffer.alloc(10 * 1024 * 1024 + 1) })
      ).status(),
    ).toBe(413);
  }
});

test('Admin lifecycle/import and Player completion through the full stack', async ({
  page,
  browser,
  request,
  fixtures: f,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const adminTokens = await tokensFromLogin(page, f.admin);
  const adminHeaders = { Authorization: `Bearer ${adminTokens.accessToken}` };
  await navigate(page, '/admin/kanji-quiz/questions');
  await page.getByRole('link', { name: 'Create question', exact: true }).click();
  await page.getByRole('button', { name: 'Create draft question' }).click();
  await expect(page.getByRole('alert')).toContainText('Check the highlighted fields');
  for (const [id, value] of Object.entries({
    sentenceReading: '😀がっこうへいく',
    targetStart: '1',
    targetLength: '4',
    targetReading: 'がっこう',
    lessonIds: String(f.lessonId),
    explanationEn: f.marker,
  }))
    await page.locator(`#${id}`).fill(value);
  for (const [i, text] of ['学校', '学生', '先生', '大学'].entries())
    await page.locator(`#option-${i}`).fill(text);
  await page.getByLabel('Option 1 is correct', { exact: true }).check();
  const created = await action(page, 'Create draft question', bank);
  await page.getByRole('link', { name: /Edit created question/ }).click();
  await page.locator('#explanationVi').fill('Trường học');
  await action(page, 'Save changes', `${bank}/${created.id}`);
  await page.getByRole('button', { name: 'Edit option 2', exact: true }).click();
  await page.getByLabel('Kanji option text').fill('生徒');
  await action(page, 'Save option', `/options/${created.options[1].id}`);
  for (const index of [2, 1]) {
    await page.getByRole('radio', { name: new RegExp(`Option ${index}:`) }).check();
    await action(page, 'Save correct answer', '/correct-option');
  }
  const published = await action(page, 'Publish question', '/publish');
  expect(
    (
      await request.post(`${bank}/${created.id}/unpublish`, {
        headers: adminHeaders,
        data: { version: created.version },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(bank + '/' + created.id + '/unpublish', {
        headers: adminHeaders,
        data: { version: published.version },
      })
    ).status(),
  ).toBe(200);
  await action(page, 'Unpublish question', '/unpublish', 409);
  await expect(page.getByRole('button', { name: 'Reload latest question' })).toBeVisible();
  await page.getByRole('button', { name: 'Reload latest question' }).click();
  await action(page, 'Publish question', '/publish');
  await page.getByRole('link', { name: 'Back to Question Bank', exact: true }).click();
  await page.getByRole('link', { name: 'Preview JSON import' }).click();
  const item = {
    content: {
      sourceType: 'CUSTOM',
      sentenceReading: '😀がっこうです',
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
      explanationEn: f.marker,
      levelIds: [],
      lessonIds: [],
    },
    options: ['学校', '学生', '先生', '大学'].map((text, i) => ({ text, correct: i === 0 })),
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'quiz.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([item, { ...item, content: { ...item.content, lessonIds: [2147483647] } }]),
    ),
  });
  await action(page, 'Import file', `${bank}/import`);
  await expect(page.getByText(/Total: 2 \/ Imported: 1 \/ Failed: 1/)).toBeVisible();
  await expect(page.getByText(/Partial success\. Imported questions/)).toBeVisible();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8088' });
  const player = await context.newPage();
  player.on('pageerror', (e) => errors.push(e.message));
  try {
    let tokens = await tokensFromLogin(player, f.player);
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    expect((await request.get(bank, { headers })).status()).toBe(403);
    expect((await request.get('/api/auth/admin-test', { headers })).status()).toBe(403);
    // Controlled transport failure: the retry below returns to the actual gateway.
    await player.route(
      '**/api/v1/kanji-quiz/config',
      (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
      { times: 1 },
    );
    await navigate(player, '/kanji-quiz');
    await expect(player.getByRole('alert')).toContainText('Unable to load quiz configuration');
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await player.route(
      '**/api/v1/kanji-quiz/config',
      async (route) => {
        await held;
        await route.continue({
          headers: { ...route.request().headers(), authorization: 'Bearer quiz-e2e-invalid' },
        });
      },
      { times: 1 },
    );
    await player.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(player.getByRole('status')).toContainText('Loading quiz configuration');
    const autoRefresh = player.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'));
    release();
    const refreshResponse = await autoRefresh;
    expect(refreshResponse.status()).toBe(200);
    const rotated = await refreshResponse.json();
    tokens = rotated.data ?? rotated;
    const lesson = player.getByLabel('Lesson', { exact: true });
    const value = await lesson
      .locator('option')
      .filter({ hasText: f.marker })
      .getAttribute('value');
    await lesson.selectOption(value);
    await player.getByLabel('Number of questions').fill('0');
    await player.getByRole('button', { name: 'Start Game' }).click();
    await expect(player.locator('#count-error')).not.toBeEmpty();
    await player.getByLabel('Number of questions').fill('1');
    const session = await action(player, 'Start Game', `${quiz}/sessions`);
    // Wait for Angular navigation before exercising browser refresh.
    await expect(player).toHaveURL(new RegExp('/kanji-quiz/sessions/' + session.sessionId + '$'));
    await expect(player.getByRole('radio')).toHaveCount(4);
    const sessionUrl = player.url();
    await player.reload();
    await expect(player).toHaveURL(/\/login\?returnUrl=/);
    await login(player, f.player);
    await expect(player).toHaveURL(sessionUrl);
    await expect(player.getByRole('radio')).toHaveCount(4);
    await expect(player.locator('mark')).toHaveText('がっこう');
    await player.setViewportSize({ width: 390, height: 844 });
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(player.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    await player.getByRole('radio', { name: '学校', exact: true }).check();
    const answerRequest = player.waitForRequest((r) => r.url().endsWith('/answers'));
    await action(player, 'Submit answer', '/answers');
    expect(
      (
        await request.post((await answerRequest).url(), {
          headers,
          data: (await answerRequest).postDataJSON(),
        })
      ).status(),
    ).toBe(409);
    await expect(player.getByText('Correct!', { exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Continue to finish' }).click();
    player.once('dialog', (d) => d.dismiss());
    await player.getByRole('button', { name: 'Finish Game', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Finish Game', exact: true })).toBeVisible();
    player.once('dialog', (d) => d.accept());
    await action(player, 'Finish Game', '/finish');
    await expect(player.getByRole('heading', { name: 'Quiz Results', exact: true })).toBeVisible();
    await expect(player.getByText(/Session .*Completed/)).toBeVisible();
    expect(
      (await request.post(`${quiz}/sessions/${session.sessionId}/finish`, { headers })).status(),
    ).toBe(409);
    expect(
      (
        await request.get(`${quiz}/sessions/${session.sessionId}`, { headers: adminHeaders })
      ).status(),
    ).toBe(404);
    await paceAuth();
    const otherLogin = await request.post('/api/auth/login', {
      data: { email: f.other.email, password: f.other.password },
    });
    expect(otherLogin.status()).toBe(200);
    const otherBody = await otherLogin.json();
    const otherHeaders = { Authorization: 'Bearer ' + (otherBody.data ?? otherBody).accessToken };
    expect(
      (
        await request.get(quiz + '/sessions/' + session.sessionId, { headers: otherHeaders })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(quiz + '/history/' + session.sessionId, { headers: otherHeaders })
      ).status(),
    ).toBe(404);
    const progress = await request.get(quiz + '/progress', { headers });
    expect((await progress.json()).data).toMatchObject({
      completedSessions: 1,
      answeredCount: 1,
      correctCount: 1,
    });
    await player.getByRole('link', { name: 'History', exact: true }).click();
    await expect(player.getByRole('link', { name: /^Session / }).first()).toBeVisible();
    await player.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(player.getByRole('heading', { name: /Progress/ }).first()).toBeVisible();
    await player.reload();
    await expect(player).toHaveURL(/\/login(?:\?|$)/);
    await login(player, f.player);
    await navigate(player, '/kanji-quiz');
    await player.getByRole('link', { name: 'History', exact: true }).click();
    await player
      .getByRole('link', { name: /^Session / })
      .first()
      .click();
    await expect(player.getByRole('heading', { name: 'Quiz Results', exact: true })).toBeVisible();
    await player.getByRole('link', { name: 'Game Setup', exact: true }).click();
    const secondLesson = player.getByLabel('Lesson', { exact: true });
    await secondLesson.selectOption(
      await secondLesson.locator('option').filter({ hasText: f.marker }).getAttribute('value'),
    );
    await player.getByLabel('Number of questions').fill('1');
    await action(player, 'Start Game', quiz + '/sessions');
    await player.getByRole('radio', { name: '\u751f\u5f92', exact: true }).check();
    await action(player, 'Submit answer', '/answers');
    await expect(player.getByText('Incorrect.', { exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Continue to finish' }).click();
    player.once('dialog', (dialog) => dialog.accept());
    await action(player, 'Finish Game', '/finish');
    const finalProgress = await request.get(quiz + '/progress', { headers });
    expect((await finalProgress.json()).data).toMatchObject({
      completedSessions: 2,
      answeredCount: 2,
      correctCount: 1,
      incorrectCount: 1,
    });
    const breakdown = await request.get(quiz + '/progress/breakdown', { headers });
    expect((await breakdown.json()).data.lessons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: 'ASSIGNED',
          lessonId: f.lessonId,
          answeredCount: 2,
        }),
      ]),
    );
    const refreshed = await request.post('/api/auth/refresh', {
      data: { refreshToken: tokens.refreshToken },
    });
    expect(refreshed.status()).toBe(200);
    expect(
      (
        await request.post('/api/auth/refresh', { data: { refreshToken: tokens.refreshToken } })
      ).status(),
    ).toBe(401);
    const body = await refreshed.json();
    const replacement = body.data ?? body;
    expect(
      (
        await request.post('/api/auth/logout', { data: { refreshToken: replacement.refreshToken } })
      ).status(),
    ).toBe(204);
    expect(
      (
        await request.post('/api/auth/refresh', {
          data: { refreshToken: replacement.refreshToken },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await context.close();
  }
  await page.getByRole('link', { name: 'Back to Question Bank', exact: true }).click();
  await page.locator(`a[href="/admin/kanji-quiz/questions/${created.id}/edit"]`).click();
  page.once('dialog', (d) => d.accept());
  await action(page, 'Archive question', '/archive');
  await expect(page.getByText(/Archived questions are read-only/)).toBeVisible();
  expect(errors).toEqual([]);
});
