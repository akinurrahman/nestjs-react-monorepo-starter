import type { AuthResponse } from '@starter/shared';
import { isApiError } from './api-error';

export type RefreshHandlers = {
  // Gets a new session without storing it. Rejects when the session is gone.
  refresh: () => Promise<AuthResponse>;
  // Who this tab is signed in as, or null before the startup refresh.
  currentUserId: () => string | null;
  // Stores the session the refresh returned.
  onRefreshed: (session: AuthResponse) => void;
  // Runs once when the refresh returned someone else: another tab signed in
  // as a different user, and the shared cookie is theirs now.
  onSwitched: () => void;
  // Runs once per refresh the api refused with a 401: the session is gone.
  onFailed: () => void;
  // Runs once per refresh that failed any other way: offline, 429, 5xx. That
  // says nothing about the session, so nothing is cleared. `error` says how.
  onUnavailable: (error: unknown) => void;
};

// 'ended': the api refused the refresh with a 401, the session is gone.
// 'switched': the refresh answered for another user, nothing was stored.
// 'unavailable': it failed any other way, and `error` says how.
export type RefreshResult =
  | { status: 'refreshed' }
  | { status: 'ended' }
  | { status: 'switched' }
  | { status: 'unavailable'; error: unknown };

let handlers: RefreshHandlers | null = null;
let inFlight: Promise<RefreshResult> | null = null;
// Sticky until the page reloads. onSwitched clears the session, so a later
// refresh (a query refetching after the cache clear) would see no user, read
// as the startup check and adopt the other user before the reload lands.
let switched = false;

// The auth feature owns the refresh request and what a failure clears, and
// lib cannot import a feature, so it registers them here.
export function setRefreshHandlers(next: RefreshHandlers | null): void {
  handlers = next;
  switched = false;
}

/**
 * Single flight: a call made while a refresh is running gets that refresh's
 * promise instead of starting another. Startup and every request that hit an
 * expired token share it, so a burst of 401s, or StrictMode mounting twice,
 * sends one refresh request. The api rotates the refresh token on each use,
 * so parallel refreshes would also race each other for the cookie.
 *
 * The user check lives here, not in a caller, so no path can store a session
 * for someone other than the tab's user, and a burst of 401s switches once.
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
  if (switched) return { status: 'switched' };
  try {
    const session = await current.refresh();
    // The registration current now, not at the start: StrictMode
    // re-registers while the first refresh is still in flight.
    const latest = handlers ?? current;
    const userId = latest.currentUserId();
    if (userId !== null && session.user.id !== userId) {
      switched = true;
      latest.onSwitched();
      return { status: 'switched' };
    }
    latest.onRefreshed(session);
    return { status: 'refreshed' };
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      handlers?.onFailed();
      return { status: 'ended' };
    }
    handlers?.onUnavailable(error);
    return { status: 'unavailable', error };
  }
}
