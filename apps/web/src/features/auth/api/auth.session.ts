import type { AuthResponse } from '@starter/shared';
import type { QueryClient } from '@tanstack/react-query';
import { clearAccessToken, setAccessToken } from '@/lib/api/access-token';
import { endSession, setSessionUser, type SessionEnd } from '@/systems/session';

export function startSession({ accessToken, user }: AuthResponse): void {
  setAccessToken(accessToken);
  setSessionUser(user);
}

// Clears everything this browser holds for the session: the token, the user,
// and every cached query and mutation, so the next person to sign in never
// sees data fetched for the last one.
export function endLocalSession(
  queryClient: QueryClient,
  endedBy: SessionEnd | null,
): void {
  clearAccessToken();
  endSession(endedBy);
  queryClient.clear();
}
