import type { LucideIcon } from 'lucide-react';
import {
  canAccessRoute,
  readRouteHandle,
  type AppRouteObject,
  type RouteHandle,
} from '@/systems/router';
import type { SessionUser } from '@/systems/session';

export type NavItem = {
  path: string;
  title: string;
  icon: LucideIcon;
  order: number;
  keywords: readonly string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

function warn(message: string) {
  if (import.meta.env.DEV) console.warn(`[nav] ${message}`);
}

function joinPath(parent: string, segment: string | undefined): string {
  if (!segment) return parent;
  if (segment.startsWith('/')) return segment;
  return `${parent.replace(/\/$/, '')}/${segment}`;
}

/**
 * Sidebar entries from the route config rather than the current matches, so
 * every route is listed before its chunk loads. A route is listed when it has
 * nav and passes the same access check the router applies, ancestors
 * included. Known groups follow groupOrder; any other group warns in dev and
 * goes after them in the order it first appears.
 */
export function buildNav(
  routes: readonly AppRouteObject[],
  user: Pick<SessionUser, 'role'> | null,
  groupOrder: readonly string[],
  basePath = '/',
): NavGroup[] {
  const groups = new Map<string, NavItem[]>();

  function visit(
    list: readonly AppRouteObject[],
    parentPath: string,
    ancestors: (RouteHandle | undefined)[],
  ) {
    for (const route of list) {
      const path = route.index ? parentPath : joinPath(parentPath, route.path);
      const handle = readRouteHandle(route.handle);
      const chain = [...ancestors, handle];

      if (handle?.public && ancestors.some((ancestor) => ancestor?.roles)) {
        warn(
          `public route "${handle.title}" on ${path} under a roles parent is treated as not public.`,
        );
      }

      if (handle?.nav) {
        if (/[:*]/.test(path)) {
          warn(
            `"${handle.title}" has nav on ${path}, which needs params. Skipped.`,
          );
        } else if (canAccessRoute(chain, user)) {
          const items = groups.get(handle.nav.group) ?? [];
          items.push({
            path,
            title: handle.title,
            icon: handle.icon,
            order: handle.nav.order,
            keywords: handle.keywords ?? [],
          });
          groups.set(handle.nav.group, items);
        }
      }

      if (route.children) visit(route.children, path, chain);
    }
  }

  visit(routes, basePath, []);

  for (const label of groups.keys()) {
    if (!groupOrder.includes(label)) {
      warn(`Group "${label}" is not in NAV_GROUPS. Listed last.`);
    }
  }

  const rank = (label: string) => {
    const index = groupOrder.indexOf(label);
    return index === -1 ? groupOrder.length : index;
  };

  return [...groups]
    .map(([label, items]) => ({
      label,
      items: items.toSorted((a, b) => a.order - b.order),
    }))
    .toSorted((a, b) => rank(a.label) - rank(b.label));
}
