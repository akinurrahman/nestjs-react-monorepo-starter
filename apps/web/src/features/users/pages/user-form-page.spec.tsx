import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ERROR_CODES, type ErrorResponse } from '@starter/shared';
import { delay, http, HttpResponse } from 'msw';
import { testUser } from '@/test/auth-fixtures';
import {
  conflict,
  internalError,
  tooManyRequests,
} from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';
import {
  emailTaken,
  findUserRow,
  makeUser,
  preloadRoutes,
  serveUsers,
  USERS_PATH,
} from '@/test/user-fixtures';
import { usersRoutes } from '../routes';

// Same id as the fixture's Linus; name and email come from defaultUsers.
const LINUS = makeUser(2);
const ADA = testUser('ADMIN');

const nameInput = () => screen.getByLabelText(/^Name/);
const emailInput = () => screen.getByLabelText(/^Email/);
const roleSelect = () => screen.getByRole('combobox', { name: /^Role/ });

const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

// Messages the client schema never shows, so a hit proves the server's
// message reached the field.
const serverRejected = {
  statusCode: 400,
  code: ERROR_CODES.VALIDATION_FAILED,
  message: 'Validation failed',
  errors: [
    { path: 'name', message: 'Name is reserved', code: 'custom' },
    { path: 'email', message: 'Email domain is blocked', code: 'custom' },
  ],
} satisfies ErrorResponse;

function answerCreate(body: ErrorResponse, init: ResponseInit = {}) {
  server.use(
    http.post(USERS_PATH, () =>
      HttpResponse.json(body, { status: body.statusCode, ...init }),
    ),
  );
}

async function fillAndCreate(email = 'kath@example.com') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/^Name/), 'Katherine');
  await user.type(emailInput(), email);
  await user.type(screen.getByLabelText(/^Password/), 'long enough');
  await user.click(screen.getByRole('button', { name: 'Create user' }));
  return user;
}

beforeAll(() => preloadRoutes(usersRoutes), 30_000);

describe('create user', () => {
  it('creates from the list, lands back on it and shows the new row', async () => {
    const api = serveUsers();
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users');
    await findUserRow('Linus User');

    await user.click(screen.getByRole('button', { name: 'New user' }));
    await user.type(await screen.findByLabelText(/^Name/), 'Katherine');
    await user.type(emailInput(), 'Kath@Example.com');
    await user.type(screen.getByLabelText(/^Password/), 'long enough');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/users'));
    expect(await findUserRow('Katherine')).toBeInTheDocument();
    expect(screen.getByText('User created')).toBeInTheDocument();
    expect(api.bodiesOf('POST', USERS_PATH)).toEqual([
      {
        email: 'kath@example.com',
        name: 'Katherine',
        role: 'USER',
        password: 'long enough',
      },
    ]);
  });

  it('puts EMAIL_TAKEN under the email field and stays on the page', async () => {
    serveUsers();
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users/new');

    await user.type(await screen.findByLabelText(/^Name/), 'Another Linus');
    await user.type(emailInput(), 'linus@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'long enough');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() =>
      expect(emailInput()).toHaveAccessibleDescription(emailTaken.message),
    );
    expect(emailInput()).toHaveFocus();
    expect(router.state.location.pathname).toBe('/users/new');
    // On the field only: no toast and no form-level message repeat it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getAllByText(emailTaken.message)).toHaveLength(1);
  });

  it('shows plain messages for an empty form without a request', async () => {
    const api = serveUsers();
    const user = userEvent.setup();
    renderApp(usersRoutes, '/users/new');

    await user.click(
      await screen.findByRole('button', { name: 'Create user' }),
    );

    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByText('Enter an email')).toBeInTheDocument();
    expect(screen.getByText('Enter a password')).toBeInTheDocument();
    expect(api.bodiesOf('POST', USERS_PATH)).toEqual([]);
  });

  it('puts server validation errors under their fields', async () => {
    serveUsers();
    answerCreate(serverRejected);
    const { router } = renderApp(usersRoutes, '/users/new');

    await fillAndCreate();

    await waitFor(() =>
      expect(nameInput()).toHaveAccessibleDescription('Name is reserved'),
    );
    expect(emailInput()).toHaveAccessibleDescription('Email domain is blocked');
    expect(nameInput()).toHaveFocus();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(router.state.location.pathname).toBe('/users/new');
  });

  it('shows a 4xx without field errors once, above the actions', async () => {
    serveUsers();
    answerCreate(conflict);
    renderApp(usersRoutes, '/users/new');

    await fillAndCreate();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      conflict.message,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getAllByText(conflict.message)).toHaveLength(1);
  });

  it('shows safe copy for a 500, not the server message', async () => {
    serveUsers();
    answerCreate(internalError);
    renderApp(usersRoutes, '/users/new');

    await fillAndCreate();

    expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_MESSAGE);
    expect(screen.queryByText(internalError.message)).toBeNull();
  });

  it('says how long to wait after a 429', async () => {
    serveUsers();
    answerCreate(tooManyRequests, { headers: { 'Retry-After': '30' } });
    renderApp(usersRoutes, '/users/new');

    await fillAndCreate();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests. Try again in 30 seconds.',
    );
  });

  it('disables submit while the create is pending', async () => {
    serveUsers();
    let sent = 0;
    server.use(
      http.post(USERS_PATH, async () => {
        sent += 1;
        await delay('infinite');
      }),
    );
    renderApp(usersRoutes, '/users/new');

    const user = await fillAndCreate();

    const pending = await screen.findByRole('button', { name: 'Creating' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(sent).toBe(1);
  });
});

describe('edit user', () => {
  it('prefills from the detail query', async () => {
    serveUsers();
    renderApp(usersRoutes, `/users/${LINUS.id}/edit`);

    expect(
      await screen.findByRole('heading', { name: 'Edit Linus User' }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Linus User');
    expect(emailInput()).toHaveValue('linus@example.com');
    expect(roleSelect()).toHaveTextContent('User');
    expect(roleSelect()).not.toHaveAttribute('data-disabled');
  });

  it('saves, lands on the list and shows the change there', async () => {
    const api = serveUsers();
    const user = userEvent.setup();
    const { router } = renderApp(usersRoutes, '/users');

    await user.click(await screen.findByRole('link', { name: 'Linus User' }));
    await screen.findByRole('heading', { name: 'Edit Linus User' });
    await user.clear(nameInput());
    await user.type(nameInput(), 'Linus Torvalds');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/users'));
    expect(await findUserRow('Linus Torvalds')).toBeInTheDocument();
    expect(screen.getByText('User updated')).toBeInTheDocument();
    expect(api.bodiesOf('PATCH', `${USERS_PATH}/${LINUS.id}`)).toEqual([
      { email: 'linus@example.com', name: 'Linus Torvalds', role: 'USER' },
    ]);
  });

  it('shows your own role read-only', async () => {
    serveUsers();
    renderApp(usersRoutes, `/users/${ADA.id}/edit`, { user: ADA });

    await screen.findByRole('heading', { name: 'Edit Ada Admin' });
    expect(roleSelect()).toHaveTextContent('Admin');
    expect(roleSelect()).toHaveAttribute('data-disabled');
    expect(roleSelect()).toHaveAccessibleDescription(
      'You cannot change your own role.',
    );
  });

  it('updates the user menu name when you edit yourself', async () => {
    serveUsers();
    const user = userEvent.setup();
    renderApp(usersRoutes, `/users/${ADA.id}/edit`, { user: ADA });

    await screen.findByRole('heading', { name: 'Edit Ada Admin' });
    await user.clear(nameInput());
    await user.type(nameInput(), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'User menu' }),
      ).toHaveTextContent('Ada Lovelace'),
    );
  });

  it('announces that the user is loading', async () => {
    serveUsers();
    server.use(http.get(`${USERS_PATH}/:id`, () => delay('infinite')));
    renderApp(usersRoutes, `/users/${LINUS.id}/edit`);

    expect(
      await screen.findByRole('status', { name: 'Loading user' }),
    ).toBeInTheDocument();
  });

  it('shows not found for an unknown user', async () => {
    serveUsers();
    renderApp(usersRoutes, `/users/${makeUser(999).id}/edit`);

    expect(
      await screen.findByRole('heading', { name: 'Not found' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });

  it('shows the error state when the user fails to load, and retry loads it', async () => {
    serveUsers();
    // Fails until the retry click: the query client retries a 500 itself.
    let failing = true;
    server.use(
      http.get(`${USERS_PATH}/:id`, () =>
        failing ? HttpResponse.json(internalError, { status: 500 }) : undefined,
      ),
    );
    const user = userEvent.setup();
    renderApp(usersRoutes, `/users/${LINUS.id}/edit`);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_MESSAGE);
    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('heading', { name: 'Edit Linus User' }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Linus User');
  });

  // The api answers a malformed id with 400, not 404.
  it('shows not found for a malformed id', async () => {
    serveUsers();
    renderApp(usersRoutes, '/users/not-a-uuid/edit');

    expect(
      await screen.findByRole('heading', { name: 'Not found' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
