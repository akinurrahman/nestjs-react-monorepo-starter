import { createBrowserRouter } from 'react-router';
import { homeRoutes } from '@/features/home';
import type { AppRouteObject } from '@/systems/router';
import { devRoutes } from './dev/dev-routes';
import { buildRoutes } from './routes';

// Every feature's routes, listed once.
const pages: AppRouteObject[] = [...homeRoutes];

// A production build replaces import.meta.env.DEV with false, which leaves
// devRoutes unused, so it and its lazy chunks are not bundled.
export function createAppRouter() {
  return createBrowserRouter(
    buildRoutes(import.meta.env.DEV ? [...pages, ...devRoutes] : pages),
  );
}
