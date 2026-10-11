import { useMemo } from 'react';
import type { AppRouteObject } from '@/systems/router';
import { useSession } from '@/systems/session';
import { NAV_GROUPS } from '../config';
import { buildNav, type NavGroup } from './nav';

// The one nav list. The shell builds it once and hands the same groups to
// the sidebar and the command palette.
export function useNavGroups(routes: readonly AppRouteObject[]): NavGroup[] {
  const { user } = useSession();
  return useMemo(() => buildNav(routes, user, NAV_GROUPS), [routes, user]);
}
