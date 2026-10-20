import { USER_SEARCH_MAX_LENGTH } from '@starter/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { testUser } from '@/test/auth-fixtures';
import { internalError } from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';
import {
  findUserRow,
  lastAdmin,
  makeUser,
  preloadRoutes,
  serveUsers,
  USERS_PATH,
} from '@/test/user-fixtures';
import { usersRoutes } from '../routes';

// Sync, for waitFor. The open confirm dialog hides the page from role queries.
const rowOf = (name: string) =>
  screen.getByText(name, { selector: 'a' }).closest('tr') as HTMLElement;

async function openActions(name: string) {
  const user = userEvent.setup();
  const row = await findUserRow(name);
  await user.click(
    within(row).getByRole('button', { name: `Actions for ${name}` }),
  );
  return user;
}

const menuItem = (name: string) => screen.queryByRole('menuitem', { name });

const usersTable = () => screen.getByRole('table', { name: 'Users' });

const people = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    makeUser(index + 10, { name: `Person ${index + 1}` }),
  );

async function openRoleFilter() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  return {
    user,
    popup: within(await screen.findByRole('dialog', { name: 'Filters' })),
  };
}

beforeAll(() => preloadRoutes(usersRoutes), 30_000);

describe('user list', () => {
  it('renders a row per user with role and status', async () => {
    serveUsers();
    renderApp(usersRoutes, '/users');

    const linus = await findUserRow('Linus User');
    expect(within(linus).getByText('linus@example.com')).toBeInTheDocument();
    expect(within(linus).getByText('User')).toBeInTheDocument();
    expect(within(linus).getByText('Active')).toBeInTheDocument();
    expect(
      within(await findUserRow('Grace Admin')).getByText('Admin'),
    ).toBeVisible();
    expect(
      within(await findUserRow('Dora Disabled')).getByText('Disabled'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Linus User' })).toHaveAttribute(
      'href',
      `/users/${makeUser(2).id}/edit`,
    );
  });

  // The api refuses a longer search with a 400, which would leave the list
  // on an error state.
  it('caps the search at USER_SEARCH_MAX_LENGTH, from the URL and the box', async () => {
    const api = serveUsers();
    renderApp(usersRoutes, `/users?search=${'a'.repeat(150)}`);

    await waitFor(() =>
      expect(api.listQueries().at(-1)?.get('search')).toBe(
        'a'.repeat(USER_SEARCH_MAX_LENGTH),
      ),
    );
    expect(
      screen.getByRole('searchbox', { name: 'Search name or email' }),
    ).toHaveAttribute('maxlength', String(USER_SEARCH_MAX_LENGTH));
  });

  it('writes the search and status filters to the URL and refetches', async () => {
    const api = serveUsers();
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users');
    await findUserRow('Linus User');

    await user.type(
      screen.getByRole('searchbox', { name: 'Search name or email' }),
      'linus',
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe('?search=linus'),
    );
    await waitFor(() => expect(screen.queryByText('Grace Admin')).toBeNull());
    expect(api.listQueries().at(-1)?.get('search')).toBe('linus');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Disabled' }));
    await waitFor(() =>
      expect(
        new URLSearchParams(router.state.location.search).get('status'),
      ).toBe('disabled'),
    );
    await waitFor(() =>
      expect(api.listQueries().at(-1)?.get('isActive')).toBe('false'),
    );
    expect(api.listQueries().at(-1)?.has('status')).toBe(false);
  });

  it('sends the role filter from the URL as repeated params', async () => {
    const api = serveUsers();
    renderApp(usersRoutes, '/users?role=ADMIN&role=USER&role=OWNER');

    await findUserRow('Linus User');
    expect(api.listQueries().at(-1)?.getAll('role')).toEqual(['ADMIN', 'USER']);
  });

  it('shows skeleton rows while the first page loads', async () => {
    serveUsers();
    server.use(http.get(USERS_PATH, () => delay('infinite')));
    renderApp(usersRoutes, '/users');

    // A header row and the skeleton rows, no empty state.
    await waitFor(() =>
      expect(within(usersTable()).getAllByRole('row').length).toBeGreaterThan(
        2,
      ),
    );
    expect(usersTable()).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No users yet')).toBeNull();
    expect(screen.queryByText('Linus User')).toBeNull();
  });

  it('shows the error state when the list fails, and retry loads it', async () => {
    const api = serveUsers();
    // Fails until the retry click: the query client retries a 500 itself.
    let failing = true;
    server.use(
      http.get(USERS_PATH, () =>
        failing ? HttpResponse.json(internalError, { status: 500 }) : undefined,
      ),
    );
    const user = userEvent.setup();
    renderApp(usersRoutes, '/users');

    const alert = await screen.findByRole('alert');
    expect(screen.queryByRole('table', { name: 'Users' })).toBeNull();
    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await findUserRow('Linus User')).toBeInTheDocument();
    expect(api.listQueries()).toHaveLength(1);
  });

  it('pages through the api', async () => {
    const api = serveUsers(people(25));
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users');
    await findUserRow('Person 20');
    expect(screen.queryByText('Person 21')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await findUserRow('Person 25')).toBeInTheDocument();
    expect(screen.queryByText('Person 1')).toBeNull();
    expect(router.state.location.search).toBe('?page=2');
    expect(api.listQueries().at(-1)?.get('page')).toBe('2');
  });

  it('disables next page on the last page', async () => {
    serveUsers(people(25));
    renderApp(usersRoutes, '/users?page=2');

    await findUserRow('Person 25');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('goes back to page 1 when a filter changes', async () => {
    const api = serveUsers(people(25));
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users?page=2');
    await findUserRow('Person 25');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Active' }));

    await waitFor(() =>
      expect(router.state.location.search).toBe('?status=active'),
    );
    await waitFor(() =>
      expect(api.listQueries().at(-1)?.get('isActive')).toBe('true'),
    );
    expect(api.listQueries().at(-1)?.get('page')).toBe('1');
  });

  it('sends the whole search term once, not one request per key', async () => {
    const api = serveUsers();
    const user = userEvent.setup();
    renderApp(usersRoutes, '/users');
    await findUserRow('Linus User');
    const before = api.listQueries().length;

    await user.type(
      screen.getByRole('searchbox', { name: 'Search name or email' }),
      'linus',
    );
    await waitFor(() => expect(screen.queryByText('Grace Admin')).toBeNull());

    expect(
      api
        .listQueries()
        .slice(before)
        .map((query) => query.get('search')),
    ).toEqual(['linus']);
  });

  it('writes the role filter from the popover to the URL and the request', async () => {
    const api = serveUsers();
    const { router } = renderApp(usersRoutes, '/users');
    await findUserRow('Linus User');
    const { user, popup } = await openRoleFilter();

    await user.click(popup.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Admin' }));
    // The first Escape closes the option list, not the popover.
    await user.keyboard('{Escape}');
    await user.click(popup.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(router.state.location.search).toBe('?role=ADMIN'),
    );
    await waitFor(() =>
      expect(api.listQueries().at(-1)?.getAll('role')).toEqual(['ADMIN']),
    );
    await waitFor(() => expect(screen.queryByText('Linus User')).toBeNull());
    expect(await findUserRow('Grace Admin')).toBeInTheDocument();
  });

  it('shows the roles from the URL in the popover, without an unknown one', async () => {
    serveUsers();
    // Held, so the control is checked on its own; the request is covered above.
    server.use(http.get(USERS_PATH, () => delay('infinite')));
    renderApp(usersRoutes, '/users?role=ADMIN&role=OWNER');

    expect(
      await screen.findByRole('button', { name: 'Filters, 1 applied' }),
    ).toBeInTheDocument();
    const { popup } = await openRoleFilter();
    expect(popup.getByText('Admin')).toBeVisible();
    expect(popup.queryByText('User')).toBeNull();
    expect(popup.queryByText('OWNER')).toBeNull();
  });

  it('shows the empty state with no users, and a clear action when filtered', async () => {
    serveUsers([]);
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users');

    // An h2, under the page's h1.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No users yet' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Active' }));
    expect(await screen.findByText('No users match')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('table', { name: 'Users' })).getByRole('button', {
        name: 'Clear filters',
      }),
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
  });

  it('keeps an open row menu open while the list refetches', async () => {
    const api = serveUsers();
    const { queryClient } = renderApp(usersRoutes, '/users');
    await openActions('Linus User');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    const fetches = api.listQueries().length;

    await act(() => queryClient.invalidateQueries());

    expect(api.listQueries().length).toBeGreaterThan(fetches);
    expect(screen.getByRole('menuitem', { name: 'Disable' })).toBeVisible();
  });

  describe('disable and enable', () => {
    it('disables a user after confirmation and updates the row', async () => {
      serveUsers();
      renderApp(usersRoutes, '/users');
      const user = await openActions('Linus User');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Disable' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('Disable Linus User?');
      await user.click(within(dialog).getByRole('button', { name: 'Disable' }));

      await waitFor(() =>
        expect(within(rowOf('Linus User')).getByText('Disabled')).toBeVisible(),
      );
      expect(
        await screen.findByText('Linus User disabled'),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('sends nothing when the dialog is cancelled', async () => {
      const api = serveUsers();
      renderApp(usersRoutes, '/users');
      const user = await openActions('Linus User');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Disable' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(
        api.bodiesOf('POST', `${USERS_PATH}/${makeUser(2).id}/disable`),
      ).toEqual([]);
      expect(within(rowOf('Linus User')).getByText('Active')).toBeVisible();
    });

    it('disables both dialog buttons while the request is pending', async () => {
      serveUsers();
      let sent = 0;
      server.use(
        http.post(`${USERS_PATH}/:id/disable`, async () => {
          sent += 1;
          await delay('infinite');
        }),
      );
      renderApp(usersRoutes, '/users');
      const user = await openActions('Linus User');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Disable' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disable' }));

      const pending = await within(dialog).findByRole('button', {
        name: 'Disabling',
      });
      expect(pending).toBeDisabled();
      expect(
        within(dialog).getByRole('button', { name: 'Cancel' }),
      ).toBeDisabled();
      await user.click(pending);
      expect(sent).toBe(1);
    });

    it('enables a disabled user after confirmation', async () => {
      serveUsers();
      renderApp(usersRoutes, '/users');
      const user = await openActions('Dora Disabled');

      expect(menuItem('Disable')).toBeNull();
      await user.click(await screen.findByRole('menuitem', { name: 'Enable' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Enable' }));

      await waitFor(() =>
        expect(
          within(rowOf('Dora Disabled')).getByText('Active'),
        ).toBeVisible(),
      );
    });

    it('offers no disable or set password action on your own row', async () => {
      serveUsers();
      renderApp(usersRoutes, '/users', { user: testUser('ADMIN') });
      await openActions('Ada Admin');

      expect(
        await screen.findByRole('menuitem', { name: 'Edit' }),
      ).toBeVisible();
      expect(menuItem('Change password')).toBeVisible();
      expect(menuItem('Set password')).toBeNull();
      expect(menuItem('Disable')).toBeNull();
    });

    it('sends you to your account to change your own password', async () => {
      serveUsers();
      const { router } = renderApp(usersRoutes, '/users', {
        user: testUser('ADMIN'),
      });
      const user = await openActions('Ada Admin');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Change password' }),
      );

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/account'),
      );
    });

    it('shows the LAST_ADMIN message and keeps the dialog open', async () => {
      serveUsers();
      server.use(
        http.post(`${USERS_PATH}/:id/disable`, () =>
          HttpResponse.json(lastAdmin, { status: 409 }),
        ),
      );
      renderApp(usersRoutes, '/users');
      const user = await openActions('Grace Admin');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Disable' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disable' }));

      expect(await screen.findByText(lastAdmin.message)).toBeInTheDocument();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(
        within(rowOf('Grace Admin')).getByText('Active'),
      ).toBeInTheDocument();
    });
  });

  describe('set password', () => {
    it('sends the password alone, closes and toasts on success', async () => {
      const api = serveUsers();
      renderApp(usersRoutes, '/users');
      const user = await openActions('Linus User');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Set password' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Set password for Linus User',
      });
      await user.type(
        within(dialog).getByLabelText(/^New password/),
        'brand new secret',
      );
      await user.type(
        within(dialog).getByLabelText(/^Confirm new password/),
        'brand new secret',
      );
      await user.click(
        within(dialog).getByRole('button', { name: 'Set password' }),
      );

      expect(await screen.findByText('Password set')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        api.bodiesOf('POST', `${USERS_PATH}/${makeUser(2).id}/password`),
      ).toEqual([{ password: 'brand new secret' }]);
    });

    it('blocks a confirmation that does not match', async () => {
      const api = serveUsers();
      renderApp(usersRoutes, '/users');
      const user = await openActions('Linus User');

      await user.click(
        await screen.findByRole('menuitem', { name: 'Set password' }),
      );
      const dialog = await screen.findByRole('dialog');
      await user.type(
        within(dialog).getByLabelText(/^New password/),
        'brand new secret',
      );
      await user.type(
        within(dialog).getByLabelText(/^Confirm new password/),
        'something else',
      );
      await user.click(
        within(dialog).getByRole('button', { name: 'Set password' }),
      );

      expect(
        await within(dialog).findByText('Passwords do not match'),
      ).toBeInTheDocument();
      expect(
        api.bodiesOf('POST', `${USERS_PATH}/${makeUser(2).id}/password`),
      ).toEqual([]);
    });
  });
});
