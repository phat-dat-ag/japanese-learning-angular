import { AuthUser } from './auth.models';

export function authDestination(user: AuthUser): '/admin' | '/flashcards' {
  return user.role === 'Admin' ? '/admin' : '/flashcards';
}
