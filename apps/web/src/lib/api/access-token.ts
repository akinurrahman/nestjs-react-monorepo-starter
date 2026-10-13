// Memory only, never storage or a cookie, so a script injected into the page
// cannot read a token left behind. A reload starts without one and the
// startup refresh gets a new one from the httpOnly refresh cookie.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}
