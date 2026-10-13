import type { CreateUserInput, UpdateUserInput } from '@starter/shared';
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSession, setSessionUser } from '@/systems/session';
import { USER_KEYS } from '../definitions/user.constants';
import type { UserPasswordFormValues } from '../definitions/user.schema';
import type { User } from '../definitions/user.types';
import { userApi } from './user.api';

function storeUser(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(USER_KEYS.detail(user.id), user);
  void queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateUserInput) => userApi.create(values),
    onSuccess: (created) => {
      storeUser(queryClient, created);
      toast.success('User created');
    },
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateUserInput) => userApi.update(id, values),
    onSuccess: (updated) => {
      storeUser(queryClient, updated);
      // The user menu reads the session, not this cache.
      if (getSession().user?.id === updated.id) setSessionUser(updated);
      toast.success('User updated');
    },
  });
}

export function useDisableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => userApi.disable(user.id),
    onSuccess: (updated) => {
      storeUser(queryClient, updated);
      toast.success(`${updated.name} disabled`);
    },
  });
}

export function useEnableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => userApi.enable(user.id),
    onSuccess: (updated) => {
      storeUser(queryClient, updated);
      toast.success(`${updated.name} enabled`);
    },
  });
}

// Nothing cached changes: the api only revokes the user's sessions.
export function useSetUserPassword(id: string) {
  return useMutation({
    mutationFn: (values: UserPasswordFormValues) =>
      userApi.setPassword(id, values),
    onSuccess: () => {
      toast.success('Password set');
    },
  });
}
