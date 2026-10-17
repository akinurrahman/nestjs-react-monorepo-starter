import { createHash } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';
import { WEB_URL, type Account } from '../browser-env.js';

// A private address unique to the test (testId differs per project too).
// The api trusts one proxy hop, so this becomes req.ip, and each test gets
// its own rate limit buckets: login allows 5 a minute per IP and email, and
// a full run signs the admin in more often than that.
function clientIp(testId: string): string {
  const [a = 0, b = 0, c = 0] = createHash('sha256').update(testId).digest();
  return `10.${a}.${b}.${c}`;
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({
      ...extraHTTPHeaders,
      'X-Forwarded-For': clientIp(testInfo.testId),
    });
  },
});

export { expect };

export const url = (path: string): string => `${WEB_URL}${path}`;

type Envelope<T> = { data: T };

// Fills the login form the page is on. Returns the access token the login
// issued, for waitForAccessExpiry.
export async function signIn(page: Page, account: Account): Promise<string> {
  await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
  // Exact: the field's "Show password" toggle matches the name too.
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(account.password);
  const response = page.waitForResponse(
    (res) =>
      res.url() === url('/api/auth/login') && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const login = await response;
  expect(login.status()).toBe(200);
  const { data } = (await login.json()) as Envelope<{ accessToken: string }>;
  return data.accessToken;
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
}

export async function expectSignedInAs(
  page: Page,
  account: Account,
): Promise<void> {
  await expect(page.getByRole('button', { name: 'User menu' })).toHaveText(
    new RegExp(`${account.name}$`),
  );
}

// The api checks expiry itself, so the browser clock cannot be faked: this
// waits out the token's real lifetime, read from its exp claim, and no
// longer. jose treats a token as expired once now >= exp.
export async function waitForAccessExpiry(
  page: Page,
  accessToken: string,
): Promise<void> {
  const payload = accessToken.split('.')[1] ?? '';
  const { exp } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { exp: number };
  const remaining = exp * 1000 - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining + 100);
}
