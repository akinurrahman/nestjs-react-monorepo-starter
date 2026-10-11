import { Outlet } from 'react-router';
import { canAccessRoute, useHandleMatches } from '@/systems/router';
import { useSession } from '@/systems/session';
import { AccessDeniedState } from '@/systems/ui';

export function RouteAccessGate() {
  const { user } = useSession();
  const matches = useHandleMatches();
  const allowed = canAccessRoute(
    matches.map((match) => match.handle),
    user,
  );

  return allowed ? <Outlet /> : <AccessDeniedState />;
}
