import { quizSessionDestination } from './auth-destination';

describe('quiz session sign-in destination', () => {
  it.each(['/kanji-quiz/sessions/42', '/kanji-quiz/sessions/42/results'])(
    'preserves the local session path %s',
    (path) => expect(quizSessionDestination(path)).toBe(path),
  );
  it.each([
    null,
    undefined,
    '',
    'https://evil.invalid',
    '//evil.invalid',
    '/kanji-quiz/sessions/42//evil',
    '/kanji-quiz/sessions/42?next=https://evil.invalid',
    '/kanji-quiz/sessions/42#fragment',
    '/kanji-quiz/sessions/0',
    '/kanji-quiz/sessions/9007199254740992',
    '/admin',
    '/kanji-quiz/sessions/%34%32',
    '/kanji-quiz/sessions/42/../..',
    '/kanji-quiz/sessions/42\\evil',
  ])('rejects unsupported destination %s', (path) =>
    expect(quizSessionDestination(path)).toBeNull(),
  );
});
