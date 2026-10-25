import { quizSessionDestination, learningSessionDestination } from './auth-destination';

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

describe('Flashcard session sign-in destinations', () => {
  it.each(['/flashcards/sessions/9', '/kanji-quiz/sessions/3', '/kanji-quiz/sessions/3/results'])(
    'preserves %s',
    (value) => {
      expect(learningSessionDestination(value)).toBe(value);
    },
  );
  it.each([
    '/flashcards/sessions/0',
    '/flashcards/sessions/1?next=https://example.com',
    '//example.com',
    '/flashcards/sessions/1/other',
    '/flashcards/sessions/9007199254740992',
    '/flashcards/learn/12',
  ])('rejects %s', (value) => {
    expect(learningSessionDestination(value)).toBeNull();
  });
});
