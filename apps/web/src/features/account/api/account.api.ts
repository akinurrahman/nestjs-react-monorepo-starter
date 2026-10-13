import type { PublicUser, UpdateMeInput } from '@starter/shared';
import { apiCall, apiCallEmpty } from '@/lib/api/api-call';
import type { ChangePasswordFormValues } from '../definitions/account.schema';

export const accountApi = {
  updateProfile: (payload: UpdateMeInput) =>
    apiCall<PublicUser>('/users/me', { method: 'PATCH', body: payload }),

  changePassword: ({
    currentPassword,
    newPassword,
  }: ChangePasswordFormValues) =>
    apiCallEmpty('/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};
