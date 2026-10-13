import { UserRound } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

// No nav entry: the user menu links here.
export const accountRoutes: AppRouteObject[] = [
  {
    path: 'account',
    handle: { title: 'Account', icon: UserRound },
    lazy: async () => ({
      Component: (await import('./pages/account-page')).default,
    }),
  },
];
