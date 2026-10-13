import type { Role } from '@starter/shared';
import { createLookup } from '@/lib/lookup/create-lookup';

// Annotated with the api's union, so a role added there fails to compile here
// until it has a label.
export const userRoleLookup = createLookup<Role>(
  {
    ADMIN: { label: 'Admin', badgeVariant: 'info' },
    USER: { label: 'User', badgeVariant: 'secondary' },
  },
  'UserRole',
);

export type UserRole = (typeof userRoleLookup.values)[number];

// The api sends isActive. user.api.ts maps this to it and back.
export const userStatusLookup = createLookup(
  {
    active: { label: 'Active', badgeVariant: 'success' },
    disabled: { label: 'Disabled', badgeVariant: 'secondary' },
  },
  'UserStatus',
);

export type UserStatus = (typeof userStatusLookup.values)[number];
