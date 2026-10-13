import { Users } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

export const usersRoutes: AppRouteObject[] = [
  {
    path: 'users',
    handle: {
      title: 'Users',
      icon: Users,
      nav: { group: 'Admin', order: 0 },
      roles: ['ADMIN'],
      keywords: ['accounts', 'people', 'team'],
    },
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./pages/user-list-page')).default,
        }),
      },
      {
        path: 'new',
        handle: { title: 'New user', icon: Users },
        lazy: async () => ({
          Component: (await import('./pages/user-form-page')).default,
        }),
      },
      {
        path: ':id/edit',
        handle: { title: 'Edit user', icon: Users },
        lazy: async () => ({
          Component: (await import('./pages/user-form-page')).default,
        }),
      },
    ],
  },
];
