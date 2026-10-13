import { createBrowserRouter } from 'react-router';
import { accountRoutes } from '@/features/account';
import { authRoutes } from '@/features/auth';
import { homeRoutes } from '@/features/home';
import { usersRoutes } from '@/features/users';
import type { AppRouteObject } from '@/systems/router';
import { devRoutes } from './dev/dev-routes';
import { buildRoutes } from './routes';

// Every feature's routes, listed once: pages render inside the shell,
// barePages outside it.
const pages: AppRouteObject[] = [
  ...homeRoutes,
  ...usersRoutes,
  ...accountRoutes,
];
const barePages: AppRouteObject[] = [...authRoutes];

// A production build replaces import.meta.env.DEV with false, which leaves
// devRoutes unused, so it and its lazy chunks are not bundled.
export function createAppRouter() {
  return createBrowserRouter(
    buildRoutes(
      import.meta.env.DEV ? [...pages, ...devRoutes] : pages,
      barePages,
    ),
  );
}
