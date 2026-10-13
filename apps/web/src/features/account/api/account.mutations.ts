import type { UpdateMeInput } from '@starter/shared';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setSessionUser } from '@/systems/session';
import type { ChangePasswordFormValues } from '../definitions/account.schema';
import { accountApi } from './account.api';

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (values: UpdateMeInput) => accountApi.updateProfile(values),
    onSuccess: (user) => {
      setSessionUser(user);
      toast.success('Profile saved');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      accountApi.changePassword(values),
    onSuccess: () => {
      toast.success('Password changed');
    },
  });
}
