import { SearchX } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import { NotFoundState } from '@/systems/ui';
import { AppLayout } from './app-layout';
import { ProgressBar } from './navigation-progress';
import { RootRoute } from './root-route';
import { RouteAccessGate } from './route-access-gate';
import { RouteErrorBoundary, RootErrorBoundary } from './route-errors';

/**
 * root      title, progress bar, scroll restoration. Its boundary is the
 *           last resort and replaces everything, layout included.
 * layout    the shell.
 * page      pathless, inside the layout. Checks access, catches page errors
 *           and shows the initial lazy load, all without unmounting the shell.
 *
 * Tests build the same tree around their own pages.
 */
export function buildRoutes(pages: AppRouteObject[]): AppRouteObject[] {
  return [
    {
      id: 'root',
      path: '/',
      Component: RootRoute,
      ErrorBoundary: RootErrorBoundary,
      children: [
        {
          id: 'layout',
          Component: AppLayout,
          children: [
            {
              id: 'page',
              Component: RouteAccessGate,
              ErrorBoundary: RouteErrorBoundary,
              HydrateFallback: ProgressBar,
              children: [
                ...pages,
                {
                  path: '*',
                  handle: { title: 'Not found', icon: SearchX },
                  element: (
                    <NotFoundState description="This page does not exist. The link may be out of date." />
                  ),
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}
