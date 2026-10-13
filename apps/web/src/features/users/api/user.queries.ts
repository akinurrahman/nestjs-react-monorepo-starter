import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { USER_KEYS } from '../definitions/user.constants';
import type { UserFilters } from '../definitions/user.types';
import { userApi } from './user.api';

export function useUserList(filters: UserFilters) {
  return useQuery({
    queryKey: USER_KEYS.list(filters),
    queryFn: ({ signal }) => userApi.getList(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: ({ signal }) => userApi.getById(id, signal),
    enabled: Boolean(id),
  });
}
