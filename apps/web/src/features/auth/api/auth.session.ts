import type { AuthResponse } from '@starter/shared';
import type { QueryClient } from '@tanstack/react-query';
import { clearAccessToken, setAccessToken } from '@/lib/api/access-token';
import { resetConfirmation } from '@/systems/confirmation';
import { endSession, setSessionUser, type SessionEnd } from '@/systems/session';

export function startSession({ accessToken, user }: AuthResponse): void {
  setAccessToken(accessToken);
  setSessionUser(user);
}

// Clears everything this browser holds for the session: the token, the user,
// every cached query and mutation, and an open confirm dialog, so the next
// person to sign in never sees data or a question meant for the last one.
export function endLocalSession(
  queryClient: QueryClient,
  endedBy: SessionEnd | null,
): void {
  clearAccessToken();
  endSession(endedBy);
  queryClient.clear();
  resetConfirmation();
}
