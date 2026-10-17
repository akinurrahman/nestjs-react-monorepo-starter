import { randomUUID } from 'node:crypto';
import { ADMIN } from '../browser-env.js';
import { expect, signIn, test, url } from './fixtures.js';

test('an admin creates a user, then disables them', async ({
  page,
}, testInfo) => {
  // A new account every time: repeats, retries and UI mode reruns all reuse
  // one database.
  const tag = `${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
  const created = {
    name: `Created ${tag}`,
    email: `created-${tag}@browser.test`,
  };

  await page.goto('/login');
  await signIn(page, ADMIN);
  await page.goto('/users/new');

  await page.getByRole('textbox', { name: 'Name' }).fill(created.name);
  await page.getByRole('textbox', { name: 'Email' }).fill(created.email);
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill('created-user-password');
  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page).toHaveURL(url('/users'));
  await expect(page.getByText('User created')).toBeVisible();

  // Searched, so the row is on the first page however many users exist.
  // The search is debounced: wait for its list, or the refetch can land
  // while the row menu is open and close it.
  const searched = page.waitForResponse(
    (res) =>
      res.url().startsWith(url('/api/users?')) &&
      new URL(res.url()).searchParams.get('search') === created.email,
  );
  await page
    .getByRole('searchbox', { name: 'Search name or email' })
    .fill(created.email);
  await searched;
  const row = page.getByRole('row').filter({ hasText: created.email });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(created.name);
  await expect(row).toContainText('Active');

  await row
    .getByRole('button', { name: `Actions for ${created.name}` })
    .click();
  await page.getByRole('menuitem', { name: 'Disable' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: `Disable ${created.name}?`,
  });
  await dialog.getByRole('button', { name: 'Disable' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(`${created.name} disabled`)).toBeVisible();
  await expect(row).toContainText('Disabled');

  // From the api, not just the cache the mutation updated.
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: created.email }),
  ).toContainText('Disabled');
});
