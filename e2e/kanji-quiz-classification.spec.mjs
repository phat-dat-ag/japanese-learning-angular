import { test, expect, login, navigate } from './fixtures.mjs';

test('historical UNKNOWN and captured UNASSIGNED remain distinct through the browser', async ({
  page,
  fixtures,
}) => {
  fixtures.seedClassificationHistory();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, fixtures.player);
  await navigate(page, '/kanji-quiz');
  const response = page.waitForResponse((r) =>
    r.url().endsWith('/api/v1/kanji-quiz/progress/breakdown'),
  );
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const { data } = await result.json();
  for (const [dimension, title] of [
    ['levels', 'By level'],
    ['lessons', 'By lesson'],
  ]) {
    expect(data[dimension]).toHaveLength(2);
    for (const [classification, answers, correct, incorrect, accuracy] of [
      ['UNKNOWN', 1, 1, 0, 100],
      ['UNASSIGNED', 2, 1, 1, 50],
    ]) {
      const bucket = data[dimension].find((b) => b.classification === classification);
      expect(bucket).toMatchObject({
        completedSessions: 1,
        answeredCount: answers,
        correctCount: correct,
        incorrectCount: incorrect,
        accuracyPercentage: accuracy,
      });
      const row = page
        .getByRole('table', { name: title, exact: true })
        .getByRole('row')
        .filter({ hasText: classification });
      await expect(row.getByRole('rowheader')).toContainText(
        classification === 'UNKNOWN'
          ? 'classification not captured'
          : 'captured without an assignment',
      );
      await expect(row.getByRole('cell')).toHaveText([
        String(bucket.completedSessions),
        String(bucket.answeredCount),
        String(bucket.correctCount),
        String(bucket.incorrectCount),
        bucket.accuracyPercentage.toFixed(2) + '%',
      ]);
    }
  }
  expect(errors).toEqual([]);
});
