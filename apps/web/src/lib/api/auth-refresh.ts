import { isApiError } from './api-error';

export type RefreshHandlers = {
  // Gets a new access token and stores it. Rejects when the session is gone.
  refresh: () => Promise<void>;
  // Runs once per refresh the api refused with a 401: the session is gone.
  onFailed: () => void;
  // Runs once per refresh that failed any other way: offline, 429, 5xx. That
  // says nothing about the session, so nothing is cleared.
  onUnavailable: () => void;
};

// 'ended': the api refused the refresh with a 401, the session is gone.
// 'unavailable': it failed any other way, and `error` says how.
export type RefreshResult =
  | { status: 'refreshed' }
  | { status: 'ended' }
  | { status: 'unavailable'; error: unknown };

let handlers: RefreshHandlers | null = null;
let inFlight: Promise<RefreshResult> | null = null;

// The auth feature owns the refresh request and what a failure clears, and
// lib cannot import a feature, so it registers them here.
export function setRefreshHandlers(next: RefreshHandlers | null): void {
  handlers = next;
}

/**
 * Single flight: a call made while a refresh is running gets that refresh's
 * promise instead of starting another. Startup and every request that hit an
 * expired token share it, so a burst of 401s, or StrictMode mounting twice,
 * sends one refresh request. The api rotates the refresh token on each use,
 * so parallel refreshes would also race each other for the cookie.
 *
 * Never rejects: a failure resolves with how it failed.
 */
export function refreshAccessToken(): Promise<RefreshResult> {
  inFlight ??= runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(): Promise<RefreshResult> {
  const current = handlers;
  if (!current) return { status: 'ended' };
  try {
    await current.refresh();
    return { status: 'refreshed' };
  } catch (error) {
    // The registration current now, not at the start: StrictMode
    // re-registers while the first refresh is still in flight.
    if (isApiError(error) && error.status === 401) {
      handlers?.onFailed();
      return { status: 'ended' };
    }
    handlers?.onUnavailable();
    return { status: 'unavailable', error };
  }
}
