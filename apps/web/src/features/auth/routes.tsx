import { LogIn } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

// Bare pages: rendered outside the app shell.
export const authRoutes: AppRouteObject[] = [
  {
    path: 'login',
    handle: { title: 'Sign in', icon: LogIn, public: true },
    lazy: async () => ({
      Component: (await import('./pages/login-page')).default,
    }),
  },
];
