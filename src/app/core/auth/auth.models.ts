import { isRecord } from '../api/api-response.model';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface AuthUser {
  readonly userId: string;
  readonly username?: string;
  readonly email?: string;
  readonly role?: string;
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function isTokenResponse(value: unknown): value is TokenResponse {
  return (
    isRecord(value) &&
    nonEmptyString(value['accessToken']) &&
    nonEmptyString(value['refreshToken']) &&
    typeof value['expiresIn'] === 'number' &&
    Number.isSafeInteger(value['expiresIn']) &&
    value['expiresIn'] > 0
  );
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    nonEmptyString(value['userId']) &&
    ['username', 'email', 'role'].every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    )
  );
}
