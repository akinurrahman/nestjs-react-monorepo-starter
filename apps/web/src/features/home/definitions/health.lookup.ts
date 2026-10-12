import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { createLookup } from '@/lib/lookup/create-lookup';

export const healthStatusLookup = createLookup(
  {
    up: { label: 'API up', badgeVariant: 'success', icon: CircleCheck },
    databaseDown: {
      label: 'Database unavailable',
      badgeVariant: 'warning',
      icon: TriangleAlert,
    },
    unreachable: {
      label: 'API unreachable',
      badgeVariant: 'destructive',
      icon: CircleX,
    },
  },
  'HealthStatus',
);

export type HealthStatus = (typeof healthStatusLookup.values)[number];
