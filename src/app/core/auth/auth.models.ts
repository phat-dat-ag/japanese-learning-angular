import { isRecord } from '../api/api-response.model';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterRequest extends LoginRequest {
  readonly username: string;
}

export interface RegisterResponse {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly createdAt: string;
}

export function isRegisterResponse(value: unknown): value is RegisterResponse {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value['id']) &&
    nonEmptyString(value['username']) &&
    nonEmptyString(value['email']) &&
    typeof value['createdAt'] === 'string' &&
    Number.isFinite(Date.parse(value['createdAt']))
  );
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
