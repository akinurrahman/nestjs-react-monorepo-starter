import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshAccessToken, setRefreshHandlers } from '@/lib/api/auth-refresh';
import { getSession, useSession, type Session } from '@/systems/session';
import { authApi } from '../api/auth.api';
import { endLocalSession, startSession } from '../api/auth.session';

/**
 * Wires the 401 refresh in lib/api to this feature, then restores the session
 * from the refresh cookie once. Returns the session status, 'checking' until
 * that first refresh has answered either way.
 *
 * The startup refresh goes through the same single flight as the 401 path,
 * so StrictMode's second mount joins the first request rather than sending
 * another one.
 */
export function useSessionBootstrap(): Session['status'] {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    setRefreshHandlers({
      refresh: async () => startSession(await authApi.refresh()),
      // No user means this was the startup check, and there was no session
      // to expire.
      onFailed: () =>
        endLocalSession(queryClient, getSession().user ? 'expired' : null),
    });
    if (getSession().status === 'checking') void refreshAccessToken();
    return () => setRefreshHandlers(null);
  }, [queryClient]);

  return status;
}
