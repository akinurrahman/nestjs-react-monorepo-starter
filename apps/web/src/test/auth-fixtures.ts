import {
  ERROR_CODES,
  type AuthResponse,
  type ErrorResponse,
  type PublicUser,
  type Role,
} from '@starter/shared';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { authRoutes } from '@/features/auth';
import { setAccessToken } from '@/lib/api/access-token';
import { setSessionUser } from '@/systems/session';
import { server } from './msw-server';

export const REFRESH_PATH = '/api/auth/refresh';
export const LOGIN_PATH = '/api/auth/login';
export const LOGOUT_PATH = '/api/auth/logout';

export function testUser(role: Role = 'ADMIN'): PublicUser {
  return {
    id:
      role === 'ADMIN'
        ? '01990000-0000-7000-8000-00000000a001'
        : '01990000-0000-7000-8000-00000000a002',
    email: `${role.toLowerCase()}@example.com`,
    name: role === 'ADMIN' ? 'Ada Admin' : 'Uma User',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function authResponse(
  user: PublicUser = testUser(),
  accessToken = 'fresh-token',
): { data: AuthResponse } {
  return { data: { accessToken, user } };
}

// As if the person had signed in: a token for lib/api, a user for the UI.
export function signIn(user: PublicUser, accessToken = 'test-token'): void {
  setAccessToken(accessToken);
  setSessionUser(user);
}

export const unauthorized = {
  statusCode: 401,
  code: ERROR_CODES.UNAUTHORIZED,
  message: 'Authentication required',
} satisfies ErrorResponse;

export const invalidSession = {
  statusCode: 401,
  code: ERROR_CODES.INVALID_SESSION,
  message: 'Session expired, log in again',
} satisfies ErrorResponse;

export const invalidCredentials = {
  statusCode: 401,
  code: ERROR_CODES.INVALID_CREDENTIALS,
  message: 'Invalid email or password',
} satisfies ErrorResponse;

export const serviceUnavailable = {
  statusCode: 503,
  code: ERROR_CODES.SERVICE_UNAVAILABLE,
  message: 'Service unavailable',
} satisfies ErrorResponse;

export const tooManyRequests = {
  statusCode: 429,
  code: ERROR_CODES.TOO_MANY_REQUESTS,
  message: 'Too many requests, try again later',
} satisfies ErrorResponse;

// The refresh failing without saying anything about the session, with the
// error code and message a request that needed it then fails with.
export const REFRESH_UNAVAILABLE = [
  [
    'a 503',
    () => HttpResponse.json(serviceUnavailable, { status: 503 }),
    'SERVICE_UNAVAILABLE',
    'Could not reach the server. Check your connection and try again.',
  ],
  [
    'a proxy 502',
    () =>
      new HttpResponse('<html><body>Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    'BAD_RESPONSE',
    'Could not reach the server. Check your connection and try again.',
  ],
  [
    'a 429',
    () => HttpResponse.json(tooManyRequests, { status: 429 }),
    'TOO_MANY_REQUESTS',
    'Too many requests, try again later',
  ],
  [
    'a network error',
    () => HttpResponse.error(),
    'NETWORK_ERROR',
    'Could not reach the server. Check your connection and try again.',
  ],
] as const satisfies readonly (readonly [
  string,
  () => Response,
  string,
  string,
])[];

// Serves POST /api/auth/refresh and counts the calls.
export function serveRefresh(resolver: () => Response | Promise<Response>) {
  const count = { value: 0 };
  server.use(
    http.post(REFRESH_PATH, () => {
      count.value += 1;
      return resolver();
    }),
  );
  return count;
}

export function findLoginHeading() {
  return screen.findByRole('heading', { name: 'Sign in' });
}

// The login page is a lazy chunk, and its first import in a test file pulls
// in the form system, which under a full parallel run can take longer than a
// test's whole budget. A spec that lands on /login warms it in beforeAll.
export async function preloadLoginPage(): Promise<void> {
  for (const route of authRoutes) await route.lazy?.();
}

export function refreshSucceeds(user?: PublicUser, accessToken?: string) {
  return serveRefresh(() => HttpResponse.json(authResponse(user, accessToken)));
}

export function refreshFails() {
  return serveRefresh(() => HttpResponse.json(invalidSession, { status: 401 }));
}
