import type { AuthResponse, LoginInput } from '@starter/shared';
import { apiCall, apiCallEmpty } from '@/lib/api/api-call';

export const authApi = {
  login: (payload: LoginInput) =>
    apiCall<AuthResponse>('/auth/login', { method: 'POST', body: payload }),

  refresh: () => apiCall<AuthResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => apiCallEmpty('/auth/logout', { method: 'POST' }),
};
