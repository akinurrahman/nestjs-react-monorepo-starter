import { ADMIN, USER } from '../browser-env.js';
import {
  expect,
  expectSignedInAs,
  signIn,
  signOut,
  test,
  url,
  waitForAccessExpiry,
} from './fixtures.js';

// Pages in one browser context share the refresh cookie, like tabs.

test('a stale tab never saves as the user another tab signed in as', async ({
  context,
  page: pageB,
}) => {
  await pageB.goto('/account');
  const userToken = await signIn(pageB, USER);
  await expect(pageB).toHaveURL(url('/account'));

  // Boots from the shared cookie as the USER, then switches it to the admin.
  const pageA = await context.newPage();
  await pageA.goto('/');
  await expectSignedInAs(pageA, USER);
  await signOut(pageA);
  await expect(pageA).toHaveURL(url('/login'));
  await signIn(pageA, ADMIN);
  await expectSignedInAs(pageA, ADMIN);

  // B still holds the USER's access token. Once it expires, the save's
  // refresh answers with the admin.
  await waitForAccessExpiry(pageB, userToken);
  await pageB.getByRole('textbox', { name: 'Name' }).fill('Hijacked');
  await pageB.getByRole('button', { name: 'Save profile' }).click();

  // B reloads as the cookie's user instead of retrying the save as them.
  await expect(pageB).toHaveURL(url('/'));
  await expectSignedInAs(pageB, ADMIN);

  // The admin's name is untouched, as the api reports it on a fresh boot.
  await pageA.reload();
  await expectSignedInAs(pageA, ADMIN);
});

test('signing out in one tab sends the other to /login on its next admin action', async ({
  context,
  page: pageA,
}) => {
  await pageA.goto('/login');
  await signIn(pageA, ADMIN);
  await expect(pageA).toHaveURL(url('/'));

  const pageB = await context.newPage();
  await pageB.goto('/users/new');
  await expect(pageB.getByRole('heading', { name: 'New user' })).toBeVisible();

  await signOut(pageA);
  await expect(pageA).toHaveURL(url('/login'));

  // B's access token may still be valid, but admin routes check that its
  // session is live, and the sign-out ended it.
  await pageB.getByRole('textbox', { name: 'Name' }).fill('Never Created');
  await pageB
    .getByRole('textbox', { name: 'Email' })
    .fill('never@browser.test');
  await pageB
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill('never-created-password');
  const create = pageB.waitForResponse(
    (res) =>
      res.url() === url('/api/users') && res.request().method() === 'POST',
  );
  await pageB.getByRole('button', { name: 'Create user' }).click();

  expect((await create).status()).toBe(401);
  await expect(pageB).toHaveURL((current) => current.pathname === '/login');
  await expect(pageB.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
