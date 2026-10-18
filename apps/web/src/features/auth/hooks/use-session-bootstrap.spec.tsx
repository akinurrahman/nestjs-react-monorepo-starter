import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText } from 'lucide-react';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { getAccessToken } from '@/lib/api/access-token';
import { apiCall } from '@/lib/api/api-call';
import { pageLocation } from '@/lib/platform';
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
  tooManyRequests,
  unauthorized,
} from '@/test/auth-fixtures';
import { internalError } from '@/test/error-fixtures';
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

const SESSION_EXPIRED = 'Your session expired. Sign in again to continue.';

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
    // No session to expire: a first visit is not told it timed out.
    expect(screen.queryByText(SESSION_EXPIRED)).toBeNull();
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

  const UNREACHABLE = "Can't reach the server";
  const CHECK_CONNECTION = 'Check your connection and try again.';

  // What the screen says depends on why the refresh got no answer: only an
  // unreachable server is a connection problem.
  it.each([
    [
      'a network error',
      () => HttpResponse.error(),
      UNREACHABLE,
      CHECK_CONNECTION,
    ],
    [
      'a proxy 502',
      () =>
        new HttpResponse('<html><body>Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      UNREACHABLE,
      CHECK_CONNECTION,
    ],
    [
      'a 503',
      () => HttpResponse.json(serviceUnavailable, { status: 503 }),
      UNREACHABLE,
      CHECK_CONNECTION,
    ],
    [
      'a 429 with Retry-After',
      () =>
        HttpResponse.json(tooManyRequests, {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      'Too many requests',
      'Try again in 30 seconds.',
    ],
    [
      'a 429 without Retry-After',
      () => HttpResponse.json(tooManyRequests, { status: 429 }),
      'Too many requests',
      'Wait a moment, then try again.',
    ],
    [
      'a 500',
      () => HttpResponse.json(internalError, { status: 500 }),
      'The server ran into a problem',
      'Try again in a moment.',
    ],
  ])(
    'explains the failure, not login, when the refresh fails with %s',
    async (_, respond, heading, description) => {
      serveRefresh(respond);

      const { router } = renderApp(pages, '/reports', { restore: true });
      const locations = trackLocations(router);

      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(description);
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
    expect(screen.getByText(SESSION_EXPIRED)).toBeInTheDocument();
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

  describe('when another tab signed in meanwhile', () => {
    function ProfilePage() {
      const save = useMutation({
        mutationFn: () =>
          apiCall<string>('/profile', { method: 'PATCH', body: { name: 'x' } }),
        onSuccess: () => toast.success('Profile saved'),
      });
      return (
        <button type="button" onClick={() => save.mutate()}>
          Save
        </button>
      );
    }

    const profilePages: AppRouteObject[] = [
      {
        path: 'profile',
        handle: { title: 'Profile', icon: FileText },
        Component: ProfilePage,
      },
    ];

    // The Authorization header of every PATCH, answering 200 only to the
    // fresh token.
    function serveProfile() {
      const seen: (string | null)[] = [];
      server.use(
        http.patch('/api/profile', ({ request }) => {
          const auth = request.headers.get('Authorization');
          seen.push(auth);
          return auth === 'Bearer fresh-token'
            ? HttpResponse.json({ data: 'saved' })
            : HttpResponse.json(unauthorized, { status: 401 });
        }),
      );
      return seen;
    }

    let replace: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      replace = vi.spyOn(pageLocation, 'replace').mockImplementation(() => {});
    });
    afterEach(() => replace.mockRestore());

    it('drops the request and reloads when the refresh returns another user', async () => {
      const user = userEvent.setup();
      const refresh = serveRefresh(() =>
        HttpResponse.json(authResponse(testUser('ADMIN'))),
      );
      const patches = serveProfile();
      const { queryClient } = renderApp(profilePages, '/profile', {
        user: testUser('USER'),
      });
      await screen.findByRole('button', { name: 'Save' });
      queryClient.setQueryData(PREVIOUS_KEY, 'cached for Uma');

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
      expect(replace).toHaveBeenCalledWith('/');
      expect(refresh.value).toBe(1);
      expect(patches).toEqual(['Bearer test-token']);
      expect(getAccessToken()).toBeNull();
      expect(useSessionStore.getState().user).toBeNull();
      expect(queryClient.getQueryData(PREVIOUS_KEY)).toBeUndefined();
      expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(0);
    });

    it('retries once when the refresh returns the same user with a new token', async () => {
      const user = userEvent.setup();
      serveRefresh(() => HttpResponse.json(authResponse(testUser('USER'))));
      const patches = serveProfile();
      renderApp(profilePages, '/profile', { user: testUser('USER') });

      await user.click(await screen.findByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Profile saved')).toBeInTheDocument();
      expect(patches).toEqual(['Bearer test-token', 'Bearer fresh-token']);
      expect(getAccessToken()).toBe('fresh-token');
      expect(replace).not.toHaveBeenCalled();
    });
  });

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
