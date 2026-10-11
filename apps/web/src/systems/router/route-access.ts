import type { SessionUser } from '@/systems/session';
import type { RouteHandle } from './route-handle';

// Every matched route that lists roles must list the user's, so a child can
// never widen what its parent allows.
export function canAccessRoute(
  handles: readonly (RouteHandle | undefined)[],
  user: Pick<SessionUser, 'role'> | null,
): boolean {
  return handles.every((handle) => {
    if (!handle?.roles) return true;
    return user !== null && handle.roles.includes(user.role);
  });
}
