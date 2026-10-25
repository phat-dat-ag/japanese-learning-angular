import { AuthUser } from './auth.models';

export function authDestination(user: AuthUser): '/admin' | '/flashcards' {
  return user.role === 'Admin' ? '/admin' : '/flashcards';
}

// Only quiz session deep links may survive sign-in; never accept arbitrary redirect URLs.
export function quizSessionDestination(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^\/kanji-quiz\/sessions\/([1-9]\d*)(?:\/results)?$/);
  return match && Number.isSafeInteger(Number(match[1])) ? value : null;
}

// Preserve only explicitly supported learning-session URLs through authentication.
export function learningSessionDestination(value: string | null | undefined): string | null {
  const quiz = quizSessionDestination(value);
  if (quiz) return quiz;
  const match = value?.match(/^\/flashcards\/sessions\/([1-9]\d*)$/);
  return match && Number.isSafeInteger(Number(match[1])) ? value! : null;
}
