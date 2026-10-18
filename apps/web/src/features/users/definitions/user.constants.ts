import { DEFAULT_PAGE_LIMIT, USER_SEARCH_MAX_LENGTH } from '@starter/shared';
import { defineUrlFilters, pagingSpec } from '@/systems/filters';
import { userRoleLookup, userStatusLookup } from './user.lookup';
import type { UserFilters } from './user.types';

export const USER_KEYS = {
  all: ['users'] as const,
  lists: () => [...USER_KEYS.all, 'list'] as const,
  list: (filters: UserFilters) => [...USER_KEYS.lists(), filters] as const,
  details: () => [...USER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export const USER_FILTER_SPEC = defineUrlFilters<UserFilters>({
  search: { maxLength: USER_SEARCH_MAX_LENGTH },
  role: { kind: 'list', values: userRoleLookup.values },
  status: { values: userStatusLookup.values },
  ...pagingSpec(DEFAULT_PAGE_LIMIT),
});
