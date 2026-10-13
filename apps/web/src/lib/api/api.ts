import { ERROR_CODES } from '@starter/shared';
import axios, { isAxiosError, type AxiosError } from 'axios';
import { env } from '@/lib/env';
import { getAccessToken } from './access-token';
import { toApiError } from './api-error';
import { refreshAccessToken } from './auth-refresh';

declare module 'axios' {
  interface AxiosRequestConfig {
    // Set on the one retry after a refresh, so a second 401 is final.
    authRetried?: boolean;
  }
}

// A 401 from these is the answer itself, never a reason to refresh: a wrong
// password, a dead session, or the refresh failing.
const AUTH_ENDPOINTS = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
]);

export const api = axios.create({
  baseURL: `${env.VITE_API_BASE_URL}/api`,
  // Sends the refresh cookie when the api is on another origin, such as a
  // sibling subdomain. It is scoped to /api/auth, so other routes never get it.
  withCredentials: true,
  // The api parses queries with Express's simple parser: a=1&a=2 becomes an
  // array, while a[]=1 stays a literal key named "a[]".
  paramsSerializer: { indexes: null },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// UNAUTHORIZED only: INVALID_CREDENTIALS and INVALID_SESSION mean logging in
// again, which a refresh cannot fix.
function isExpiredAccess(
  error: unknown,
): error is AxiosError<unknown> & Required<Pick<AxiosError, 'config'>> {
  if (!isAxiosError(error) || !error.config || !error.response) return false;
  const { config, response } = error;
  const body: unknown = response.data;
  return (
    response.status === 401 &&
    !config.authRetried &&
    !AUTH_ENDPOINTS.has(config.url ?? '') &&
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === ERROR_CODES.UNAUTHORIZED
  );
}

// Refresh once, shared by every request waiting on it, then retry this
// request once. The retry runs the request interceptor again, which attaches
// the new token. A failed refresh has already cleared the session.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isExpiredAccess(error)) throw error;
  if (!(await refreshAccessToken())) throw error;
  return api.request({ ...error.config, authRetried: true });
});

// Keep this the last response interceptor. The refresh one above needs the
// raw AxiosError and its config; callers get ApiError.
api.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toApiError(error)),
);
