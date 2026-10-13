import { Navigate, Outlet, useLocation } from 'react-router';
import { loginPath } from '@/features/auth';
import { canAccessRoute, useHandleMatches } from '@/systems/router';
import { useSession } from '@/systems/session';
import { AccessDeniedState } from '@/systems/ui';

export function RouteAccessGate() {
  const { user, endedBy } = useSession();
  const { pathname, search } = useLocation();
  const matches = useHandleMatches();
  const allowed = canAccessRoute(
    matches.map((match) => match.handle),
    user,
  );

  if (allowed) return <Outlet />;
  if (user) return <AccessDeniedState />;
  // Replace, so Back does not land on a page that only redirects again.
  // After a logout there is nowhere worth returning to.
  return (
    <Navigate
      replace
      to={loginPath(endedBy === 'logout' ? undefined : pathname + search)}
    />
  );
}
