import type { PublicUser } from '@starter/shared';
import { create } from 'zustand';

export type SessionUser = PublicUser;

// Why the last session ended. Logout sends the person to plain /login, an
// expired session sends them there with a redirect back to where they were.
export type SessionEnd = 'logout' | 'expired';

export type Session = {
  // 'checking' until the startup refresh has answered. Nothing behind a
  // route renders before then, so a signed-in person never sees /login.
  status: 'checking' | 'ready';
  user: SessionUser | null;
  endedBy: SessionEnd | null;
};

// Holds the user, never the access token: components read who is signed in,
// and only lib/api ever touches the token.
export const useSessionStore = create<Session>()(() => ({
  status: 'checking',
  user: null,
  endedBy: null,
}));

export function useSession(): Session {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const endedBy = useSessionStore((state) => state.endedBy);
  return { status, user, endedBy };
}

// For code outside React, such as the refresh failure handler.
export function getSession(): Session {
  return useSessionStore.getState();
}

export function setSessionUser(user: SessionUser): void {
  useSessionStore.setState({ status: 'ready', user, endedBy: null });
}

// null: there was no session to end, as when the startup refresh finds none.
export function endSession(endedBy: SessionEnd | null): void {
  useSessionStore.setState({ status: 'ready', user: null, endedBy });
}
