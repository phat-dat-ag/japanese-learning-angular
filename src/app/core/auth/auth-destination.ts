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
