export const LOGIN_PATH = '/login';

export const REDIRECT_PARAM = 'redirect';

export function loginPath(redirect?: string): string {
  if (!redirect) return LOGIN_PATH;
  return `${LOGIN_PATH}?${new URLSearchParams({ [REDIRECT_PARAM]: redirect }).toString()}`;
}
