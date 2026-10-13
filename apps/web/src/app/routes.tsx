import { SearchX } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import { NotFoundState } from '@/systems/ui';
import { ProgressBar } from './navigation-progress';
import { RootRoute } from './root-route';
import { RouteAccessGate } from './route-access-gate';
import { RouteErrorBoundary, RootErrorBoundary } from './route-errors';
import { AppShell } from './shell/app-shell';

/**
 * root      title, progress bar, scroll restoration. Its boundary is the
 *           last resort and replaces everything, layout included.
 * bare      pathless, outside the shell, for screens like login. Same access
 *           check, error boundary and initial load as page.
 * layout    the shell. Its sidebar lists the pages from this config, so
 *           every nav entry shows before its chunk loads.
 * page      pathless, inside the layout. Checks access, catches page errors
 *           and shows the initial lazy load, all without unmounting the shell.
 *
 * Tests build the same tree around their own pages.
 */
export function buildRoutes(
  pages: AppRouteObject[],
  barePages: AppRouteObject[] = [],
): AppRouteObject[] {
  return [
    {
      id: 'root',
      path: '/',
      Component: RootRoute,
      ErrorBoundary: RootErrorBoundary,
      children: [
        {
          id: 'bare',
          Component: RouteAccessGate,
          ErrorBoundary: RouteErrorBoundary,
          HydrateFallback: ProgressBar,
          children: barePages,
        },
        {
          id: 'layout',
          element: <AppShell navRoutes={pages} />,
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
                  handle: { title: 'Not found', icon: SearchX, public: true },
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
