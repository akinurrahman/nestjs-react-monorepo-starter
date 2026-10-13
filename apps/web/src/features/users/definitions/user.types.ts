import type { PublicUser } from '@starter/shared';
import type { UserRole, UserStatus } from './user.lookup';

export type { UserRole, UserStatus };

export type User = PublicUser;

export type UserFilters = {
  search?: string;
  role?: UserRole[];
  status?: UserStatus;
  page: number;
  limit: number;
};
