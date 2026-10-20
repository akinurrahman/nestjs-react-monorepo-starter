import type { Page } from '@playwright/test';
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

// Collects console errors and page errors, each tagged with the page that
// was open, set through `at`.
function watchErrors(page: Page) {
  const state = { current: 'sign-in', errors: [] as string[] };
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text() !== EXPECTED_401) {
      state.errors.push(`${state.current}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) =>
    state.errors.push(`${state.current}: ${error.message}`),
  );
  return {
    errors: state.errors,
    at: (path: string) => (state.current = path),
  };
}

// The sidebar's links, as the pages to visit.
async function navPages(page: Page): Promise<PageCase[]> {
  const navLinks = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link');
  await expect(navLinks.first()).toBeVisible();
  return navLinks.evaluateAll((links) =>
    links.map((link) => ({
      path: link.getAttribute('href') ?? '',
      heading: link.textContent.trim(),
    })),
  );
}

// A full load each time, so every page's chunk loads from cold.
async function visit(page: Page, { path, heading }: PageCase) {
  await page.goto(path);
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  await expect(page.getByText('This page could not be shown')).toBeHidden();
}

// The user id is the access token's subject.
function subjectOf(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const { sub } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { sub: string };
  return sub;
}

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
  const { errors, at } = watchErrors(page);

  await page.goto('/login');
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(url('/'));

  const renders = (pageCase: PageCase) =>
    test.step(pageCase.path, async () => {
      at(pageCase.path);
      await visit(page, pageCase);
      // ErrorState: a query on the page failed.
      await expect(page.getByRole('alert')).toHaveCount(0);
    });

  for (const pageCase of [...(await navPages(page)), ...PAGES_WITHOUT_NAV]) {
    await renders(pageCase);
  }

  // After the pages above, so a broken list page fails as itself first.
  const editPath = await test.step('find /users/:id/edit', async () => {
    at('/users');
    await page.goto('/users');
    const link = page.getByRole('link', { name: USER.name, exact: true });
    await expect(link).toHaveAttribute('href', /^\/users\/[\w-]+\/edit$/);
    return (await link.getAttribute('href')) ?? '';
  });
  await renders({ path: editPath, heading: `Edit ${USER.name}` });

  await test.step('unknown path', async () => {
    at('/no-such-page');
    await page.goto('/no-such-page');
    // The breadcrumb says "Not found" too.
    await expect(
      page.getByRole('main').getByText('Not found', { exact: true }),
    ).toBeVisible();
  });

  expect(errors).toEqual([]);
});

// What a USER sees: every page in their sidebar renders, and the admin pages
// show access denied without asking the api for any user.
test('every page renders for a USER, and the users pages are denied', async ({
  page,
}) => {
  const { errors, at } = watchErrors(page);
  const usersRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/users')) {
      usersRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/login');
  const accessToken = await signIn(page, USER);
  await expect(page).toHaveURL(url('/'));

  const sidebar = await navPages(page);
  expect(sidebar.map(({ path }) => path)).not.toContain('/users');
  for (const pageCase of [
    ...sidebar,
    { path: '/account', heading: 'Account' },
  ]) {
    await test.step(pageCase.path, async () => {
      at(pageCase.path);
      await visit(page, pageCase);
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  }

  for (const path of [
    '/users',
    '/users/new',
    `/users/${subjectOf(accessToken)}/edit`,
  ]) {
    await test.step(path, async () => {
      at(path);
      await visit(page, { path, heading: 'Access denied' });
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.getByRole('textbox')).toHaveCount(0);
      await expect(
        page
          .getByRole('navigation', { name: 'Main' })
          .getByRole('link', { name: 'Users' }),
      ).toHaveCount(0);
    });
  }

  expect(usersRequests).toEqual([]);
  expect(errors).toEqual([]);
});
