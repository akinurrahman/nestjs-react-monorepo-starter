import { ADMIN, USER } from '../browser-env.js';
import { expect, signIn, test, url } from './fixtures.js';

type PageCase = { path: string; heading: string };

// The sidebar lists every route with a nav entry the admin can open, built
// from the router config, so a new page with nav is covered without a change
// here. These are the rest: pages with no nav entry. Routes with params are
// resolved in the test from links the app renders.
const PAGES_WITHOUT_NAV: PageCase[] = [
  { path: '/account', heading: 'Account' },
  { path: '/users/new', heading: 'New user' },
];

// Chromium logs every 401 response as a console error. Those are the auth
// flow working: the startup refresh before sign-in, and an access token
// expiring (it lasts 5s here) just before the silent refresh. A 401 the app
// does not recover from shows on the page, which the checks below catch.
const EXPECTED_401 =
  'Failed to load resource: the server responded with a status of 401 (Unauthorized)';

// Layout, so it needs a real browser. The default viewport is desktop, where
// ancestor crumbs show and the 32px touch target rule applies.
test('breadcrumb links are at least 32px tall', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, ADMIN);
  await page.goto('/users/new');

  const crumb = page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Users' });
  await expect(crumb).toBeVisible();
  const box = await crumb.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(32);
});

test('every page renders for an admin without errors', async ({ page }) => {
  let current = 'sign-in';
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text() !== EXPECTED_401) {
      errors.push(`${current}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`${current}: ${error.message}`));

  await page.goto('/login');
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(url('/'));

  const navLinks = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link');
  await expect(navLinks.first()).toBeVisible();
  const navPages = await navLinks.evaluateAll((links) =>
    links.map((link) => ({
      path: link.getAttribute('href') ?? '',
      heading: link.textContent.trim(),
    })),
  );

  const visit = ({ path, heading }: PageCase) =>
    test.step(path, async () => {
      current = path;
      // A full load each time, so every page's chunk loads from cold.
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible();
      await expect(page.getByText('This page could not be shown')).toBeHidden();
      // ErrorState: a query on the page failed.
      await expect(page.getByRole('alert')).toHaveCount(0);
    });

  for (const pageCase of [...navPages, ...PAGES_WITHOUT_NAV]) {
    await visit(pageCase);
  }

  // After the pages above, so a broken list page fails as itself first.
  const editPath = await test.step('find /users/:id/edit', async () => {
    current = '/users';
    await page.goto('/users');
    const link = page.getByRole('link', { name: USER.name, exact: true });
    await expect(link).toHaveAttribute('href', /^\/users\/[\w-]+\/edit$/);
    return (await link.getAttribute('href')) ?? '';
  });
  await visit({ path: editPath, heading: `Edit ${USER.name}` });

  await test.step('unknown path', async () => {
    current = '/no-such-page';
    await page.goto(current);
    // The breadcrumb says "Not found" too.
    await expect(
      page.getByRole('main').getByText('Not found', { exact: true }),
    ).toBeVisible();
  });

  expect(errors).toEqual([]);
});
