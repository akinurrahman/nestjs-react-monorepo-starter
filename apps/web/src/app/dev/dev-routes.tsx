import { Bug, Hourglass, Unplug } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

export const SLOW_ROUTE_DELAY_MS = 3000;

// Routes for trying the app's failure and loading paths by hand. router.ts
// adds them only when import.meta.env.DEV, so a production build drops this
// module and every chunk it lazy loads.
export const devRoutes: AppRouteObject[] = [
  {
    path: 'dev/throws',
    handle: { title: 'Throwing page', icon: Bug },
    lazy: async () => ({
      Component: (await import('./dev-fault-pages')).ThrowingPage,
    }),
  },
  {
    path: 'dev/chunk-error',
    handle: { title: 'Missing chunk', icon: Unplug },
    // Chromium's wording for a chunk a deploy removed. A real import of a
    // missing file fails differently in each engine and in the dev server.
    lazy: () =>
      Promise.reject(
        new TypeError(
          'Failed to fetch dynamically imported module: /assets/dev-missing-chunk.js',
        ),
      ),
  },
  {
    path: 'dev/slow',
    handle: { title: 'Slow page', icon: Hourglass },
    lazy: async () => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_ROUTE_DELAY_MS));
      return { Component: (await import('./dev-fault-pages')).SlowPage };
    },
  },
];
