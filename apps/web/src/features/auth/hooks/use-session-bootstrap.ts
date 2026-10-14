import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { refreshAccessToken, setRefreshHandlers } from '@/lib/api/auth-refresh';
import { pageLocation } from '@/lib/platform';
import {
  getSession,
  setSessionChecking,
  setSessionUnreachable,
  useSession,
  type Session,
} from '@/systems/session';
import { authApi } from '../api/auth.api';
import { endLocalSession, startSession } from '../api/auth.session';

/**
 * Wires the 401 refresh in lib/api to this feature, then restores the session
 * from the refresh cookie once. Returns the session status, 'checking' until
 * that first refresh has answered, and `retry` for when it could not reach
 * the server ('unreachable').
 *
 * The startup refresh goes through the same single flight as the 401 path,
 * so StrictMode's second mount joins the first request rather than sending
 * another one.
 */
export function useSessionBootstrap(): {
  status: Session['status'];
  retry: () => void;
} {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    setRefreshHandlers({
      refresh: () => authApi.refresh(),
      currentUserId: () => getSession().user?.id ?? null,
      onRefreshed: startSession,
      // Another tab signed in as someone else. Boot fresh as the cookie's
      // user rather than turn this page into theirs. The navigation starts
      // first so it is already under way when the cleared session re-renders.
      onSwitched: () => {
        pageLocation.replace('/');
        endLocalSession(queryClient, null);
      },
      // No user means this was the startup check, and there was no session
      // to expire.
      onFailed: () =>
        endLocalSession(queryClient, getSession().user ? 'expired' : null),
      // Mid-session the request that needed the refresh fails on its own and
      // the session stays. At startup nothing can render without an answer.
      onUnavailable: () => {
        if (getSession().status === 'checking') setSessionUnreachable();
      },
    });
    if (getSession().status === 'checking') void refreshAccessToken();
    return () => setRefreshHandlers(null);
  }, [queryClient]);

  const retry = useCallback(() => {
    setSessionChecking();
    void refreshAccessToken();
  }, []);

  return { status, retry };
}
