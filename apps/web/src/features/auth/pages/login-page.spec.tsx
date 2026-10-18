import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, House } from 'lucide-react';
import { http, HttpResponse } from 'msw';
import { getAccessToken } from '@/lib/api/access-token';
import type { AppRouteObject } from '@/systems/router';
import { endSession } from '@/systems/session';
import { useSessionStore } from '@/systems/session/session-store';
import {
  authResponse,
  findLoginHeading,
  preloadLoginPage,
  invalidCredentials,
  LOGIN_PATH,
  refreshSucceeds,
  testUser,
} from '@/test/auth-fixtures';
import { internalError, tooManyRequests } from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';

const pages: AppRouteObject[] = [
  {
    index: true,
    handle: { title: 'Home', icon: House },
    element: <p>home page</p>,
  },
  {
    path: 'reports',
    handle: { title: 'Reports', icon: FileText },
    element: <p>reports page</p>,
  },
];

function serveLogin(resolver: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(LOGIN_PATH, async ({ request }) => {
      bodies.push(await request.json());
      return resolver();
    }),
  );
  return bodies;
}

async function submitLogin(url: string) {
  const user = userEvent.setup();
  const app = renderApp(pages, url, { user: null });
  await findLoginHeading();
  await user.type(screen.getByLabelText(/Email/), '  Ada@Example.com ');
  await user.type(screen.getByLabelText(/^Password/), 'correct horse');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return app;
}

beforeAll(preloadLoginPage, 30_000);

describe('login page', () => {
  it('signs in and goes to the redirect target', async () => {
    const bodies = serveLogin(() =>
      HttpResponse.json(authResponse(testUser('ADMIN'))),
    );

    const { router } = await submitLogin('/login?redirect=%2Freports%3Fq%3D1');

    expect(await screen.findByText('reports page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reports');
    expect(router.state.location.search).toBe('?q=1');
    expect(bodies).toEqual([
      { email: 'ada@example.com', password: 'correct horse' },
    ]);
    expect(getAccessToken()).toBe('fresh-token');
    expect(useSessionStore.getState().user?.name).toBe('Ada Admin');
  });

  it('goes home without a redirect', async () => {
    serveLogin(() => HttpResponse.json(authResponse()));

    const { router } = await submitLogin('/login');

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it.each([
    ['an external url', 'https://evil.example/x'],
    ['a protocol-relative url', '//evil.example/x'],
    ['a backslash host', '/\\evil.example'],
    ['the login page itself', '/login?redirect=/reports'],
  ])('goes home instead of %s', async (_name, redirect) => {
    serveLogin(() => HttpResponse.json(authResponse()));

    const { router } = await submitLogin(
      `/login?redirect=${encodeURIComponent(redirect)}`,
    );

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  // The person was sent here, so they should know why. After signing out,
  // or on a first visit, there is nothing to explain.
  it.each([
    ['expired', true],
    ['logout', false],
    [null, false],
  ] as const)(
    'says the session expired only when it did (endedBy %s)',
    async (endedBy, shown) => {
      renderApp(pages, '/login', { user: null });
      act(() => endSession(endedBy));

      await findLoginHeading();
      const notice = screen.queryByText(
        'Your session expired. Sign in again to continue.',
      );
      if (shown) expect(notice).toBeInTheDocument();
      else expect(notice).toBeNull();
    },
  );

  it('shows INVALID_CREDENTIALS as one form message, not on the fields', async () => {
    const refresh = refreshSucceeds();
    serveLogin(() => HttpResponse.json(invalidCredentials, { status: 401 }));

    await submitLogin('/login');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText(/Email/)).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(/^Password/)).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // A failed login is the answer, never a reason to refresh.
    expect(refresh.value).toBe(0);
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('shows the message of a 429', async () => {
    serveLogin(() => HttpResponse.json(tooManyRequests, { status: 429 }));

    await submitLogin('/login');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, try again later',
    );
  });

  it('says how long to wait when a 429 sends Retry-After', async () => {
    serveLogin(() =>
      HttpResponse.json(tooManyRequests, {
        status: 429,
        headers: { 'Retry-After': '42' },
      }),
    );

    await submitLogin('/login');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests. Try again in 42 seconds.',
    );
  });

  it('shows safe copy for a server error', async () => {
    serveLogin(() => HttpResponse.json(internalError, { status: 500 }));

    await submitLogin('/login');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Please try again.',
    );
  });

  it('asks for both fields in plain words on an empty submit, without a request', async () => {
    const user = userEvent.setup();
    const bodies = serveLogin(() => HttpResponse.json(authResponse()));
    renderApp(pages, '/login', { user: null });
    await findLoginHeading();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByLabelText(/Email/, {
        selector: '[aria-invalid="true"]',
      }),
    ).toHaveAccessibleDescription('Enter your email');
    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(
      'Enter your password',
    );
    expect(bodies).toHaveLength(0);
  });

  it('asks for a valid email', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/login', { user: null });
    await findLoginHeading();

    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText(/^Password/), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByLabelText(/Email/, {
        selector: '[aria-invalid="true"]',
      }),
    ).toHaveAccessibleDescription('Enter a valid email');
  });

  it('sends a signed-in visitor home', async () => {
    const { router } = renderApp(pages, '/login', { user: testUser('USER') });

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders outside the app shell', async () => {
    renderApp(pages, '/login', { user: null });

    await findLoginHeading();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});
