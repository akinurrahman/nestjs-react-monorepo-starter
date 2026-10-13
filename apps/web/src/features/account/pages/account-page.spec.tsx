import { ERROR_CODES, type ErrorResponse } from '@starter/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { testUser } from '@/test/auth-fixtures';
import { tooManyRequests } from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';
import { preloadRoutes } from '@/test/user-fixtures';
import { accountRoutes } from '../routes';

const ME_PATH = '/api/users/me';
const PASSWORD_PATH = '/api/auth/password';

const invalidCurrentPassword = {
  statusCode: 400,
  code: ERROR_CODES.INVALID_CURRENT_PASSWORD,
  message: 'Current password is incorrect',
  errors: [
    {
      path: 'currentPassword',
      message: 'Current password is incorrect',
      code: ERROR_CODES.INVALID_CURRENT_PASSWORD,
    },
  ],
} satisfies ErrorResponse;

function serve(
  method: 'patch' | 'post',
  path: string,
  resolver: (body: unknown) => Response,
) {
  const bodies: unknown[] = [];
  server.use(
    http[method](path, async ({ request }) => {
      const body: unknown = await request.json();
      bodies.push(body);
      return resolver(body);
    }),
  );
  return bodies;
}

const field = (label: RegExp) => screen.getByLabelText(label);

async function renderAccount() {
  const user = userEvent.setup();
  renderApp(accountRoutes, '/account', { user: testUser('USER') });
  await screen.findByRole('heading', { name: 'Account' });
  return user;
}

async function fillPassword(
  user: ReturnType<typeof userEvent.setup>,
  {
    current = 'old secret',
    next = 'new secret!',
    confirm = next,
  }: { current?: string; next?: string; confirm?: string } = {},
) {
  await user.type(field(/^Current password/), current);
  await user.type(field(/^New password/), next);
  await user.type(field(/^Confirm new password/), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

beforeAll(() => preloadRoutes(accountRoutes), 30_000);

describe('account profile', () => {
  it('saves the name and updates the user menu', async () => {
    const bodies = serve('patch', ME_PATH, (body) =>
      HttpResponse.json({ data: { ...testUser('USER'), ...(body as object) } }),
    );
    const user = await renderAccount();

    expect(field(/^Name/)).toHaveValue('Uma User');
    await user.clear(field(/^Name/));
    await user.type(field(/^Name/), 'Uma Renamed');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'User menu' }),
      ).toHaveTextContent('Uma Renamed'),
    );
    expect(screen.getByText('Profile saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ name: 'Uma Renamed' }]);
  });

  it('is linked from the user menu', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(
      [...accountRoutes, { path: 'elsewhere', element: <p>elsewhere</p> }],
      '/elsewhere',
      { user: testUser('USER') },
    );
    await screen.findByText('elsewhere');

    await user.click(screen.getByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Account' }));

    expect(
      await screen.findByRole('heading', { name: 'Account' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/account');
  });
});

describe('account password', () => {
  it('sends the two shared fields, toasts and clears the form', async () => {
    const bodies = serve(
      'post',
      PASSWORD_PATH,
      () => new HttpResponse(null, { status: 204 }),
    );
    const user = await renderAccount();

    await fillPassword(user);

    expect(await screen.findByText('Password changed')).toBeInTheDocument();
    expect(bodies).toEqual([
      { currentPassword: 'old secret', newPassword: 'new secret!' },
    ]);
    await waitFor(() => expect(field(/^Current password/)).toHaveValue(''));
    expect(field(/^New password/)).toHaveValue('');
    expect(field(/^Confirm new password/)).toHaveValue('');
  });

  it('puts a wrong current password under its field', async () => {
    serve('post', PASSWORD_PATH, () =>
      HttpResponse.json(invalidCurrentPassword, { status: 400 }),
    );
    const user = await renderAccount();

    await fillPassword(user);

    await waitFor(() =>
      expect(field(/^Current password/)).toHaveAccessibleDescription(
        'Current password is incorrect',
      ),
    );
    expect(field(/^New password/)).toHaveValue('new secret!');
  });

  it('blocks a confirmation that does not match, without a request', async () => {
    const bodies = serve(
      'post',
      PASSWORD_PATH,
      () => new HttpResponse(null, { status: 204 }),
    );
    const user = await renderAccount();

    await fillPassword(user, { confirm: 'something else' });

    await waitFor(() =>
      expect(field(/^Confirm new password/)).toHaveAccessibleDescription(
        'Passwords do not match',
      ),
    );
    expect(bodies).toEqual([]);
  });

  it('shows the rate limit message', async () => {
    serve('post', PASSWORD_PATH, () =>
      HttpResponse.json(tooManyRequests, { status: 429 }),
    );
    const user = await renderAccount();

    await fillPassword(user);

    expect(
      await screen.findByText(tooManyRequests.message),
    ).toBeInTheDocument();
  });
});
