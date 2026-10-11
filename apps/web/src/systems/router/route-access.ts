import type { SessionUser } from '@/systems/session';
import type { RouteHandle } from './route-handle';

// Denied unless the route says otherwise: a public route is open to anyone,
// every other route needs a user, and every matched route that lists roles
// must list the user's, so a child can never widen what its parent allows.
// That holds for public too: under a parent with roles it counts for nothing.
export function canAccessRoute(
  handles: readonly (RouteHandle | undefined)[],
  user: Pick<SessionUser, 'role'> | null,
): boolean {
  const own = handles.findLast((handle) => handle !== undefined);
  if (own?.public && !handles.some((handle) => handle?.roles)) return true;
  if (user === null) return false;
  return handles.every(
    (handle) => !handle?.roles || handle.roles.includes(user.role),
  );
}
