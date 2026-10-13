import { useQuery } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText } from 'lucide-react';
import { delay, http, HttpResponse } from 'msw';
import { getAccessToken } from '@/lib/api/access-token';
import { apiCall } from '@/lib/api/api-call';
import type { AppRouteObject } from '@/systems/router';
import { useSessionStore } from '@/systems/session/session-store';
import { ErrorState } from '@/systems/ui';
import {
  authResponse,
  findLoginHeading,
  preloadLoginPage,
  REFRESH_UNAVAILABLE,
  refreshFails,
  serveRefresh,
  serviceUnavailable,
  testUser,
  unauthorized,
} from '@/test/auth-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';

function ReportsPage() {
  const { data, error, isLoadingError } = useQuery({
    queryKey: ['reports'],
    queryFn: ({ signal }) => apiCall<string>('/reports', { signal }),
  });
  if (isLoadingError) return <ErrorState error={error} />;
  return <p>{data ?? 'loading reports'}</p>;
}

const pages: AppRouteObject[] = [
  {
    path: 'reports',
    handle: { title: 'Reports', icon: FileText },
    Component: ReportsPage,
  },
];

const PREVIOUS_KEY = ['previous'];

function serveReports() {
  server.use(
    http.get('/api/reports', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer fresh-token'
        ? HttpResponse.json({ data: 'reports for Uma' })
        : HttpResponse.json(unauthorized, { status: 401 }),
    ),
  );
}

// Every location the router commits, the first one included.
function trackLocations(router: ReturnType<typeof renderApp>['router']) {
  const seen = [router.state.location.pathname];
  router.subscribe((state) => seen.push(state.location.pathname));
  return seen;
}

beforeAll(preloadLoginPage, 30_000);

describe('session startup', () => {
  it('restores the session from the refresh cookie and renders as that user', async () => {
    const refresh = serveRefresh(() =>
      HttpResponse.json(authResponse(testUser('USER'))),
    );
    serveReports();

    renderApp(pages, '/reports', { restore: true });

    expect(await screen.findByText('reports for Uma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toHaveTextContent(
      'Uma User',
    );
    expect(refresh.value).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('shows login with a redirect back when there is no session', async () => {
    refreshFails();

    const { router } = renderApp(pages, '/reports?range=q3', {
      restore: true,
    });

    expect(await findLoginHeading()).toBeInTheDocument();
    expect(router.state.location.search).toBe(
      '?redirect=%2Freports%3Frange%3Dq3',
    );
    expect(useSessionStore.getState()).toMatchObject({
      status: 'ready',
      user: null,
      endedBy: null,
    });
  });

  it('shows only a loading screen while checking, never the login page', async () => {
    serveRefresh(async () => {
      await delay(50);
      return HttpResponse.json(authResponse(testUser('USER')));
    });
    serveReports();

    const { router } = renderApp(pages, '/reports', { restore: true });
    const locations = trackLocations(router);

    expect(
      screen.getByRole('status', { name: 'Checking your session' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    expect(await screen.findByText('reports for Uma')).toBeInTheDocument();
    expect(locations).not.toContain('/login');
    expect(
      screen.queryByRole('status', { name: 'Checking your session' }),
    ).toBeNull();
  });

  it.each(REFRESH_UNAVAILABLE)(
    "shows can't reach the server, not login, when the refresh fails with %s",
    async (_, respond) => {
      serveRefresh(respond);

      const { router } = renderApp(pages, '/reports', { restore: true });
      const locations = trackLocations(router);

      expect(
        await screen.findByRole('heading', { name: "Can't reach the server" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
      expect(locations).not.toContain('/login');
      expect(useSessionStore.getState()).toMatchObject({
        status: 'unreachable',
        user: null,
      });
    },
  );

  it('restores the session on retry once the server answers', async () => {
    const user = userEvent.setup();
    serveRefresh(() => HttpResponse.json(serviceUnavailable, { status: 503 }));
    serveReports();
    renderApp(pages, '/reports', { restore: true });

    await screen.findByRole('heading', { name: "Can't reach the server" });
    const refresh = serveRefresh(() =>
      HttpResponse.json(authResponse(testUser('USER'))),
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('reports for Uma')).toBeInTheDocument();
    expect(refresh.value).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('shows login on retry when the server then says there is no session', async () => {
    const user = userEvent.setup();
    serveRefresh(() => HttpResponse.error());
    renderApp(pages, '/reports', { restore: true });

    await screen.findByRole('heading', { name: "Can't reach the server" });
    refreshFails();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await findLoginHeading()).toBeInTheDocument();
  });

  it('sends one refresh request when StrictMode mounts twice', async () => {
    const refresh = serveRefresh(async () => {
      await delay(20);
      return HttpResponse.json(authResponse(testUser('USER')));
    });
    serveReports();

    renderApp(pages, '/reports', { restore: true, strict: true });

    expect(await screen.findByText('reports for Uma')).toBeInTheDocument();
    expect(refresh.value).toBe(1);
  });
});

describe('session expiry', () => {
  it('clears token and cache and lands on login with a redirect back when the refresh fails', async () => {
    refreshFails();
    serveReports();

    const { router, queryClient } = renderApp(
      [
        ...pages,
        {
          path: 'start',
          handle: { title: 'Start', icon: FileText },
          element: <p>start page</p>,
        },
      ],
      '/start',
      { user: testUser('ADMIN') },
    );
    await screen.findByText('start page');
    queryClient.setQueryData(PREVIOUS_KEY, 'cached for Ada');

    await act(() => router.navigate('/reports?range=q3'));

    expect(await findLoginHeading()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?redirect=%2Freports%3Frange%3Dq3',
    );
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(PREVIOUS_KEY)).toBeUndefined();
    expect(useSessionStore.getState()).toMatchObject({
      user: null,
      endedBy: 'expired',
    });
    // The redirect says it all, so no "Authentication required" toast.
    expect(screen.queryByText('Authentication required')).toBeNull();
  });

  it.each(REFRESH_UNAVAILABLE)(
    'keeps the session, cache and page and shows the refresh error for %s',
    async (_, respond, code, message) => {
      serveRefresh(respond);
      serveReports();
      const admin = testUser('ADMIN');

      const { router, queryClient } = renderApp(
        [
          ...pages,
          {
            path: 'start',
            handle: { title: 'Start', icon: FileText },
            element: <p>start page</p>,
          },
        ],
        '/start',
        { user: admin },
      );
      await screen.findByText('start page');
      queryClient.setQueryData(PREVIOUS_KEY, 'cached for Ada');

      await act(() => router.navigate('/reports'));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByText('Authentication required')).toBeNull();
      expect(queryClient.getQueryState(['reports'])?.error).toMatchObject({
        code,
      });
      expect(router.state.location.pathname).toBe('/reports');
      expect(getAccessToken()).toBe('test-token');
      expect(queryClient.getQueryData(PREVIOUS_KEY)).toBe('cached for Ada');
      expect(useSessionStore.getState()).toMatchObject({
        status: 'ready',
        user: admin,
        endedBy: null,
      });
    },
  );

  it('refreshes silently and keeps the person on the page', async () => {
    const refresh = serveRefresh(() =>
      HttpResponse.json(authResponse(testUser('ADMIN'))),
    );
    serveReports();

    renderApp(pages, '/reports', { user: testUser('ADMIN') });

    expect(await screen.findByText('reports for Uma')).toBeInTheDocument();
    expect(refresh.value).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
  });
});
