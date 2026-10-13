export type RefreshHandlers = {
  // Gets a new access token and stores it. Rejects when the session is gone.
  refresh: () => Promise<void>;
  // Runs once per failed refresh, however many callers were waiting on it.
  onFailed: () => void;
};

let handlers: RefreshHandlers | null = null;
let inFlight: Promise<boolean> | null = null;

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
 * Resolves true once a new token is stored, false when the refresh failed.
 * Never rejects.
 */
export function refreshAccessToken(): Promise<boolean> {
  inFlight ??= runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(): Promise<boolean> {
  const current = handlers;
  if (!current) return false;
  try {
    await current.refresh();
    return true;
  } catch {
    // The registration current now, not at the start: StrictMode
    // re-registers while the first refresh is still in flight.
    handlers?.onFailed();
    return false;
  }
}
