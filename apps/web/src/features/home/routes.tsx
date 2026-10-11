import { House } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

export const homeRoutes: AppRouteObject[] = [
  {
    index: true,
    handle: {
      title: 'Home',
      icon: House,
      nav: { group: 'General', order: 0 },
    },
    lazy: async () => ({
      Component: (await import('./pages/home-page')).default,
    }),
  },
];
