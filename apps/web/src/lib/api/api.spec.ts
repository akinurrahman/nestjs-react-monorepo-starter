import type { AuthResponse } from '@starter/shared';
import { delay, http, HttpResponse } from 'msw';
import {
  authResponse,
  invalidCredentials,
  invalidSession,
  refreshFails,
  refreshSucceeds,
  unauthorized,
} from '@/test/auth-fixtures';
import { server } from '@/test/msw-server';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './access-token';
import { api } from './api';
import { apiCall, apiCallEmpty } from './api-call';
import { isApiError } from './api-error';
import { refreshAccessToken, setRefreshHandlers } from './auth-refresh';

const onFailed = vi.fn();

// What the auth feature registers, minus the session store.
beforeEach(() => {
  onFailed.mockReset();
  setRefreshHandlers({
    refresh: async () => {
      const { accessToken } = await apiCall<AuthResponse>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(accessToken);
    },
    onFailed,
  });
});

afterEach(() => setRefreshHandlers(null));

// Answers 200 to the fresh token and 401 UNAUTHORIZED to anything else.
function serveProtected(path: string) {
  const seen: (string | null)[] = [];
  server.use(
    http.get(path, ({ request }) => {
      const auth = request.headers.get('Authorization');
      seen.push(auth);
      return auth === 'Bearer fresh-token'
        ? HttpResponse.json({ data: { path } })
        : HttpResponse.json(unauthorized, { status: 401 });
    }),
  );
  return seen;
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected a rejection');
}

describe('api instance', () => {
  it('sends credentials, so the refresh cookie reaches another origin', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('attaches the access token as a bearer header', async () => {
    setAccessToken('fresh-token');
    const seen = serveProtected('/api/things');

    await apiCall('/things');

    expect(seen).toEqual(['Bearer fresh-token']);
  });

  it('sends no authorization header without a token', async () => {
    clearAccessToken();
    let auth: string | null = 'unset';
    server.use(
      http.get('/api/open', ({ request }) => {
        auth = request.headers.get('Authorization');
        return HttpResponse.json({ data: 1 });
      }),
    );

    await apiCall('/open');

    expect(auth).toBeNull();
  });
});

describe('401 refresh', () => {
  beforeEach(() => setAccessToken('stale-token'));

  it('refreshes once for five concurrent 401s and retries all five', async () => {
    const refresh = serveSlowRefresh();
    const paths = ['/a', '/b', '/c', '/d', '/e'];
    const seen = paths.map((path) => serveProtected(`/api${path}`));

    const results = await Promise.all(
      paths.map((path) => apiCall<{ path: string }>(path)),
    );

    expect(refresh.value).toBe(1);
    expect(results.map((result) => result.path)).toEqual(
      paths.map((path) => `/api${path}`),
    );
    for (const requests of seen) {
      expect(requests).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
    }
  });

  it('retries only once when the retry is also a 401', async () => {
    refreshSucceeds(undefined, 'still-rejected');
    const seen = serveProtected('/api/things');

    const error = await rejection(apiCall('/things'));

    expect(isApiError(error) && error.code).toBe('UNAUTHORIZED');
    expect(seen).toHaveLength(2);
  });

  it('rejects with the original error and reports a failed refresh once', async () => {
    const refresh = refreshFails();
    serveProtected('/api/a');
    serveProtected('/api/b');

    const errors = await Promise.all([
      rejection(apiCall('/a')),
      rejection(apiCall('/b')),
    ]);

    expect(refresh.value).toBe(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
    for (const error of errors) {
      expect(isApiError(error) && error.code).toBe('UNAUTHORIZED');
    }
  });

  it.each([
    ['/auth/login', 'POST'],
    ['/auth/refresh', 'POST'],
    ['/auth/logout', 'POST'],
  ] as const)('never refreshes on a 401 from %s', async (path, method) => {
    const refresh = refreshSucceeds();
    server.use(
      http.post(`/api${path}`, () =>
        HttpResponse.json(unauthorized, { status: 401 }),
      ),
    );

    const error = await rejection(apiCallEmpty(path, { method }));

    expect(isApiError(error) && error.status).toBe(401);
    expect(refresh.value).toBe(0);
  });

  it('never refreshes when the refresh itself answers 401', async () => {
    const refresh = serveRefreshWith(unauthorized);

    expect(await refreshAccessToken()).toBe(false);
    expect(refresh.value).toBe(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['INVALID_CREDENTIALS', invalidCredentials],
    ['INVALID_SESSION', invalidSession],
  ])('never refreshes on %s', async (_code, body) => {
    const refresh = refreshSucceeds();
    server.use(
      http.get('/api/things', () => HttpResponse.json(body, { status: 401 })),
    );

    const error = await rejection(apiCall('/things'));

    expect(isApiError(error) && error.code).toBe(body.code);
    expect(refresh.value).toBe(0);
  });
});

describe('refreshAccessToken', () => {
  it('shares one request between concurrent callers', async () => {
    const refresh = serveSlowRefresh();

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(results).toEqual([true, true]);
    expect(refresh.value).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('starts a new request once the previous one has settled', async () => {
    const refresh = refreshSucceeds();

    await refreshAccessToken();
    await refreshAccessToken();

    expect(refresh.value).toBe(2);
  });
});

// Slow enough that every caller asks while the first refresh is in flight.
function serveSlowRefresh() {
  const count = { value: 0 };
  server.use(
    http.post('/api/auth/refresh', async () => {
      count.value += 1;
      await delay(30);
      return HttpResponse.json(authResponse());
    }),
  );
  return count;
}

function serveRefreshWith(body: typeof unauthorized) {
  const count = { value: 0 };
  server.use(
    http.post('/api/auth/refresh', () => {
      count.value += 1;
      return HttpResponse.json(body, { status: 401 });
    }),
  );
  return count;
}
