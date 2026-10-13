import type { LoginInput } from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
    // No success toast: landing on /login is the confirmation. A failure
    // gets its own message in place of the global one: this browser is
    // signed out anyway, but the server session, and so the refresh
    // cookie, may still be live.
    onError: () => {
      toast.error(
        'Sign out did not reach the server. Sign in and sign out again to end it there.',
      );
    },
    // Settled, not success: a failed request still signs this browser out.
    onSettled: () => endLocalSession(queryClient, 'logout'),
  });
}
