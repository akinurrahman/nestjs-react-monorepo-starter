import { ADMIN, profileUser, USER } from '../browser-env.js';
import {
  expect,
  expectSignedInAs,
  signIn,
  signOut,
  test,
  url,
  waitForAccessExpiry,
} from './fixtures.js';

test('login lands on home with the API status, logout on plain /login', async ({
  page,
}) => {
  await page.goto('/login');
  await signIn(page, ADMIN);

  await expect(page).toHaveURL(url('/'));
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByText('API up')).toBeVisible();
  await expectSignedInAs(page, ADMIN);

  await signOut(page);
  await expect(page).toHaveURL(url('/login'));
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('a reload keeps you signed in', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(url('/'));

  await page.reload();

  await expect(page).toHaveURL(url('/'));
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expectSignedInAs(page, ADMIN);
});

test('a signed-out deep link returns to its page after login', async ({
  page,
}) => {
  await page.goto('/users');
  await expect(page).toHaveURL(url('/login?redirect=%2Fusers'));

  await signIn(page, ADMIN);

  await expect(page).toHaveURL(url('/users'));
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('cell', { name: USER.email })).toBeVisible();
});

test('an expired access token is refreshed silently', async ({
  page,
}, testInfo) => {
  const account = profileUser(testInfo.project.name);
  const name = `${account.name} renamed`;
  await page.goto('/account');
  const accessToken = await signIn(page, account);
  await expect(page).toHaveURL(url('/account'));

  await waitForAccessExpiry(page, accessToken);

  const refresh = page.waitForResponse(url('/api/auth/refresh'));
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();

  expect((await refresh).status()).toBe(200);
  await expect(page.getByText('Profile saved')).toBeVisible();
  await expect(page).toHaveURL(url('/account'));

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
});

test('a USER opening an admin page directly is denied', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, USER);
  await expect(page).toHaveURL(url('/'));

  await page.goto('/users');

  await expect(page).toHaveURL(url('/users'));
  // The empty state's title is a paragraph, not a heading.
  await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeHidden();
});
