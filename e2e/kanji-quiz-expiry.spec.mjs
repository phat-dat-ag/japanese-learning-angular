import { test, expect, login, navigate, paceAuth } from './fixtures.mjs';

// Deliberately slow and opt-in: neither clocks nor security settings are altered.
test.skip(
  process.env['QUIZ_E2E_EXPIRY'] !== '1',
  'Set QUIZ_E2E_EXPIRY=1 for the natural lifetime test.',
);

test('natural JWT expiration refreshes and restores the same quiz session', async ({
  page,
  request,
  fixtures: f,
}) => {
  test.setTimeout(25 * 60_000);
  await paceAuth();
  const adminLogin = await request.post('/api/auth/login', {
    data: { email: f.admin.email, password: f.admin.password },
  });
  expect(adminLogin.status()).toBe(200);
  const adminBody = await adminLogin.json();
  const adminHeaders = { Authorization: `Bearer ${(adminBody.data ?? adminBody).accessToken}` };
  const bank = '/api/v1/admin/kanji-quiz/questions';
  const quiz = '/api/v1/kanji-quiz';
  const created = await request.post(bank, {
    headers: adminHeaders,
    data: {
      content: {
        sourceType: 'CUSTOM',
        sentenceReading: '\u304c\u3063\u3053\u3046',
        targetStart: 0,
        targetLength: 4,
        targetReading: '\u304c\u3063\u3053\u3046',
        explanationEn: f.marker,
        lessonIds: [f.lessonId],
        levelIds: [],
      },
      options: ['\u5b66\u6821', '\u5b66\u751f', '\u5148\u751f', '\u5927\u5b66'].map((text, i) => ({
        text,
        correct: i === 0,
      })),
    },
  });
  expect(created.status()).toBe(200);
  const question = (await created.json()).data;
  expect(
    (
      await request.post(`${bank}/${question.id}/publish`, {
        headers: adminHeaders,
        data: { version: question.version },
      })
    ).status(),
  ).toBe(200);
  const loginResponse = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'));
  await login(page, f.player);
  const body = await (await loginResponse).json();
  const tokens = body.data ?? body;
  const claims = JSON.parse(
    Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString('utf8'),
  );
  expect(tokens.expiresIn).toBe(900);
  expect(Number.isSafeInteger(claims.exp)).toBe(true);
  const expiresAt = claims.exp * 1000;
  expect(expiresAt - Date.now()).toBeGreaterThan(14 * 60_000);
  await navigate(page, '/kanji-quiz');
  const lesson = page.getByLabel('Lesson', { exact: true });
  await lesson.selectOption(
    await lesson.locator('option').filter({ hasText: f.marker }).getAttribute('value'),
  );
  await page.getByLabel('Number of questions').fill('1');
  const sessionResponse = page.waitForResponse(
    (r) => r.url().endsWith(quiz + '/sessions') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  expect((await sessionResponse).status()).toBe(200);
  const session = (await (await sessionResponse).json()).data;
  await expect(page.getByRole('radio')).toHaveCount(4);
  const sessionUrl = page.url();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  console.log(
    `Natural expiry: original lifetime ${tokens.expiresIn}s; waiting until ${new Date(expiresAt + 3000).toISOString()}.`,
  );
  while (Date.now() < expiresAt + 3000) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(30_000, expiresAt + 3000 - Date.now())),
    );
  }
  const headers = { Authorization: `Bearer ${tokens.accessToken}` };
  for (const path of ['/api/auth/me', `${quiz}/sessions/${session.sessionId}`]) {
    expect(
      (await request.get(path, { headers })).status(),
      'original JWT rejected after natural expiry',
    ).toBe(401);
  }
  const answerStatuses = [];
  page.on('response', (r) => {
    if (r.url().endsWith('/answers')) answerStatuses.push(r.status());
  });
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'));
  const answered = page.waitForResponse((r) => r.url().endsWith('/answers') && r.status() === 200);
  await page.getByRole('radio', { name: '\u5b66\u6821', exact: true }).check();
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  const replacementBody = await (await refreshed).json();
  const replacement = replacementBody.data ?? replacementBody;
  expect(replacement.accessToken !== tokens.accessToken).toBe(true);
  expect(
    (
      await request.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${replacement.accessToken}` },
      })
    ).status(),
  ).toBe(200);
  await answered;
  expect(answerStatuses).toEqual([401, 200]);
  await expect(page.getByText('Correct!', { exact: true })).toBeVisible();
  expect(
    (
      await request.post('/api/auth/refresh', { data: { refreshToken: tokens.refreshToken } })
    ).status(),
  ).toBe(401);
  await expect(page).toHaveURL(sessionUrl);
  await page.reload();
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await login(page, f.player);
  await expect(page).toHaveURL(sessionUrl);
  await expect(page.getByRole('button', { name: 'Finish Game', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Finish Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quiz Results', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'PASS: natural expiration rejected by .NET and Quarkus, browser 401 -> refresh -> answer 200, original refresh replay rejected, same-session reload/sign-in/completion.',
  );
});
