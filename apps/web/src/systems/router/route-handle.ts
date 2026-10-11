import type { Role } from '@starter/shared';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  useMatches,
  type IndexRouteObject,
  type LazyRouteFunction,
  type NonIndexRouteObject,
  type UIMatch,
} from 'react-router';

/**
 * Metadata on a route object. The document title, the access check, the
 * sidebar and the command palette all read it, so it sits on the route in
 * the config and never in a lazy module: everything here is known before a
 * route's chunk loads.
 */
export type RouteHandle = {
  // The page name. Document title, sidebar label, palette entry.
  title: string;
  // A lucide component, rendered by the sidebar and the palette.
  icon: LucideIcon;
  // Present means the route is a sidebar entry. Entries are grouped under
  // `group`, a heading label, and sorted by `order` ascending within it.
  nav?: { group: string; order: number };
  // Extra search terms for the command palette, which also matches the
  // title and the nav group. Synonyms only; the title is already searched.
  keywords?: readonly string[];
} & (
  | {
      // Open to everyone, signed in or not: only for a page that works with
      // no user, like login or the 404. Read from the deepest matched route
      // with a handle, so it covers that route's handle-less children, and a
      // child with its own handle has to say public itself. A public route
      // takes no roles, and under a parent with roles it counts as not
      // public.
      public: true;
      roles?: never;
    }
  | {
      // Absent: any signed-in user. A route that is not public is never open
      // without a user.
      public?: false;
      // Who may open the route. Present means the user's role must be
      // listed, and an empty list admits no one. Checked on every matched
      // route, so a parent's roles bind its children.
      roles?: readonly Role[];
    }
);

// The function form of lazy, forbidden from returning a handle. Not the
// object form: in 8.4 a rejected lazy Component on a route without a loader
// is swallowed, and the route renders blank instead of reaching its error
// boundary, so a stale deploy would go unnoticed.
type AppLazyRoute = () => Promise<
  Omit<
    Awaited<ReturnType<LazyRouteFunction<NonIndexRouteObject>>>,
    'handle'
  > & {
    handle?: never;
  }
>;

type AppRouteFields = {
  handle?: RouteHandle;
  lazy?: AppLazyRoute;
};

type AppIndexRouteObject = Omit<IndexRouteObject, 'handle' | 'lazy'> &
  AppRouteFields;

type AppNonIndexRouteObject = Omit<
  NonIndexRouteObject,
  'handle' | 'lazy' | 'children'
> &
  AppRouteFields & { children?: AppRouteObject[] };

// A RouteObject whose handle is a RouteHandle. Features type their route
// arrays with it.
export type AppRouteObject = AppIndexRouteObject | AppNonIndexRouteObject;

export type HandleMatch = Omit<UIMatch, 'handle'> & {
  handle: RouteHandle | undefined;
};

// react-router types handle as unknown. AppRouteObject is the only way a
// handle gets set, so this is the one place it is narrowed.
export function readRouteHandle(handle: unknown): RouteHandle | undefined {
  return handle as RouteHandle | undefined;
}

// useMatches, root first, with typed handles.
export function useHandleMatches(): HandleMatch[] {
  const matches = useMatches();
  return useMemo(
    () =>
      matches.map((match) => ({
        ...match,
        handle: readRouteHandle(match.handle),
      })),
    [matches],
  );
}
