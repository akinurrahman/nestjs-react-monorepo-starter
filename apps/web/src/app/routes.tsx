import type { AppRouteObject } from '@/systems/router';
import { AppLayout } from './app-layout';
import { ProgressBar } from './navigation-progress';
import { RootRoute } from './root-route';

/**
 * root      title, progress bar, scroll restoration.
 * layout    the shell.
 * page      pathless, inside the layout. Shows the initial lazy load
 *           without unmounting the shell.
 *
 * Tests build the same tree around their own pages.
 */
export function buildRoutes(pages: AppRouteObject[]): AppRouteObject[] {
  return [
    {
      id: 'root',
      path: '/',
      Component: RootRoute,
      children: [
        {
          id: 'layout',
          Component: AppLayout,
          children: [
            {
              id: 'page',
              HydrateFallback: ProgressBar,
              children: pages,
            },
          ],
        },
      ],
    },
  ];
}