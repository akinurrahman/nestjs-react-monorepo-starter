import type { LoginInput } from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from './auth.api';
import { endLocalSession, startSession } from './auth.session';

export function useLogin() {
  return useMutation({
    mutationFn: (values: LoginInput) => authApi.login(values),
    // No success toast: landing in the app is the confirmation.
    onSuccess: (response) => startSession(response),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    // Settled, not success: a failed request still signs this browser out.
    // No toast either way, landing on /login is the confirmation and a
    // failure leaves nothing the person can act on.
    onSettled: () => endLocalSession(queryClient, 'logout'),
    meta: { handledError: true },
  });
}
