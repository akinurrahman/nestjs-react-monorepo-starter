// Stub session until the auth step. That step replaces this module's
// internals and keeps useSession's shape, so routes and guards must not need
// to change when it lands.
import { ROLES, type Role } from '@starter/shared';
import { create } from 'zustand';

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
};

export type Session = {
  user: SessionUser | null;
};

// import.meta.env.DEV is replaced with false in a production build, so this
// whole branch, the stub user included, is dropped from the bundle.
const initialUser: SessionUser | null = import.meta.env.DEV
  ? {
      id: '00000000-0000-7000-8000-00000000d3e5',
      name: 'Dev Stub User',
      role: ROLES[0],
    }
  : null;

export const useSessionStore = create<Session>()(() => ({
  user: initialUser,
}));

export function useSession(): Session {
  const user = useSessionStore((state) => state.user);
  return { user };
}

// No-op without a user, so a production build never gains one.
export function setStubRole(role: Role): void {
  useSessionStore.setState((state) =>
    state.user ? { user: { ...state.user, role } } : state,
  );
}
