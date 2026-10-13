import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { House, Users } from 'lucide-react';
import { http, HttpResponse } from 'msw';
import { getAccessToken } from '@/lib/api/access-token';
import { apiCall } from '@/lib/api/api-call';
import type { AppRouteObject } from '@/systems/router';
import { useSessionStore } from '@/systems/session/session-store';
import {
  authResponse,
  findLoginHeading,
  preloadLoginPage,
  LOGIN_PATH,
  LOGOUT_PATH,
  testUser,
} from '@/test/auth-fixtures';
import { internalError } from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';

const pages: AppRouteObject[] = [
  {
    index: true,
    handle: {
      title: 'Home',
      icon: House,
      nav: { group: 'General', order: 0 },
    },
    element: <p>home page</p>,
  },
  {
    path: 'members',
    handle: {
      title: 'Members',
      icon: Users,
      nav: { group: 'General', order: 1 },
    },
    element: <p>members page</p>,
  },
];

const PREVIOUS_USER_KEY = ['members', 'list'];

function NotesPage() {
  const { data } = useQuery({
    queryKey: ['notes'],
    queryFn: ({ signal }) => apiCall<string[]>('/notes', { signal }),
  });
  return <p>{data ? data.join(', ') : 'loading notes'}</p>;
}

const menuButton = () => screen.getByRole('button', { name: 'User menu' });

function serveLogout(resolver: () => Response) {
  const count = { value: 0 };
  server.use(
    http.post(LOGOUT_PATH, () => {
      count.value += 1;
      return resolver();
    }),
  );
  return count;
}

async function signOut() {
  const user = userEvent.setup();
  const app = renderApp(pages, '/members', { user: testUser('ADMIN') });
  await screen.findByText('members page');
  app.queryClient.setQueryData(PREVIOUS_USER_KEY, ['cached for Ada']);

  await user.click(menuButton());
  await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
  await findLoginHeading();
  return app;
}

function expectSignedOut(app: Awaited<ReturnType<typeof signOut>>) {
  expect(app.router.state.location.pathname).toBe('/login');
  expect(app.router.state.location.search).toBe('');
  expect(getAccessToken()).toBeNull();
  expect(useSessionStore.getState()).toMatchObject({
    user: null,
    endedBy: 'logout',
  });
  expect(app.queryClient.getQueryData(PREVIOUS_USER_KEY)).toBeUndefined();
  expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0);
}

beforeAll(preloadLoginPage, 30_000);

describe('user menu', () => {
  it('shows the user name and initials', async () => {
    renderApp(pages, '/', { user: testUser('ADMIN') });
    await screen.findByText('home page');

    expect(menuButton()).toHaveTextContent('AAAda Admin');
  });

  it('is not shown without a user', async () => {
    renderApp(
      [
        {
          path: 'welcome',
          handle: { title: 'Welcome', icon: House, public: true },
          element: <p>welcome page</p>,
        },
      ],
      '/welcome',
      { user: null },
    );
    await screen.findByText('welcome page');

    expect(screen.queryByRole('button', { name: 'User menu' })).toBeNull();
  });

  describe('sign out', () => {
    it('logs out on the api, clears token, session and cache, and lands on login', async () => {
      const calls = serveLogout(() => new HttpResponse(null, { status: 204 }));

      const app = await signOut();

      expect(calls.value).toBe(1);
      expectSignedOut(app);
    });

    it('clears everything locally when the request fails', async () => {
      serveLogout(() => HttpResponse.json(internalError, { status: 500 }));

      const app = await signOut();

      expectSignedOut(app);
      // No toast: the person is signed out here either way.
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    });

    it('clears everything locally when the api is unreachable', async () => {
      serveLogout(() => HttpResponse.error());

      expectSignedOut(await signOut());
    });

    it('never shows the previous user data to the next user', async () => {
      const user = userEvent.setup();
      let releaseUma!: () => void;
      const umaReleased = new Promise<void>((resolve) => {
        releaseUma = resolve;
      });
      serveLogout(() => new HttpResponse(null, { status: 204 }));
      server.use(
        http.get('/api/notes', async ({ request }) => {
          const auth = request.headers.get('Authorization');
          if (auth === 'Bearer test-token') {
            return HttpResponse.json({ data: ['note for Ada'] });
          }
          await umaReleased;
          return HttpResponse.json({ data: ['note for Uma'] });
        }),
        http.post(LOGIN_PATH, () =>
          HttpResponse.json(authResponse(testUser('USER'), 'uma-token')),
        ),
      );
      renderApp([{ index: true, Component: NotesPage }], '/', {
        user: testUser('ADMIN'),
      });
      expect(await screen.findByText('note for Ada')).toBeInTheDocument();

      await user.click(menuButton());
      await user.click(
        await screen.findByRole('menuitem', { name: 'Sign out' }),
      );
      await findLoginHeading();
      await user.type(screen.getByLabelText(/Email/), 'user@example.com');
      await user.type(screen.getByLabelText(/^Password/), 'secret-password');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(await screen.findByText('loading notes')).toBeInTheDocument();
      expect(screen.queryByText('note for Ada')).toBeNull();
      releaseUma();
      expect(await screen.findByText('note for Uma')).toBeInTheDocument();
      expect(screen.queryByText('note for Ada')).toBeNull();
    });
  });
});
