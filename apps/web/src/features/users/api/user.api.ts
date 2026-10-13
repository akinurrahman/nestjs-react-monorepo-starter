import type {
  CreateUserInput,
  PaginatedResponse,
  UpdateUserInput,
} from '@starter/shared';
import { apiCall, apiCallEmpty, apiCallPaginated } from '@/lib/api/api-call';
import { userStatusLookup } from '../definitions/user.lookup';
import type { UserPasswordFormValues } from '../definitions/user.schema';
import type { User, UserFilters } from '../definitions/user.types';

export const userApi = {
  getList: (
    { status, ...filters }: UserFilters,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<User>> =>
    apiCallPaginated<User>('/users', {
      params: {
        ...filters,
        isActive:
          status === undefined
            ? undefined
            : status === userStatusLookup.keys.active,
      },
      signal,
    }),

  getById: (id: string, signal?: AbortSignal) =>
    apiCall<User>(`/users/${id}`, { signal }),

  create: (payload: CreateUserInput) =>
    apiCall<User>('/users', { method: 'POST', body: payload }),

  update: (id: string, payload: UpdateUserInput) =>
    apiCall<User>(`/users/${id}`, { method: 'PATCH', body: payload }),

  disable: (id: string) =>
    apiCall<User>(`/users/${id}/disable`, { method: 'POST' }),

  enable: (id: string) =>
    apiCall<User>(`/users/${id}/enable`, { method: 'POST' }),

  setPassword: (id: string, { password }: UserPasswordFormValues) =>
    apiCallEmpty(`/users/${id}/password`, {
      method: 'POST',
      body: { password },
    }),
};
