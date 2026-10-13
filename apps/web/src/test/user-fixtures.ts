import {
  USER_ERROR_CODES,
  type ErrorResponse,
  type PublicUser,
  type Role,
} from '@starter/shared';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AppRouteObject } from '@/systems/router';
import { testUser } from './auth-fixtures';
import { server } from './msw-server';
import { paginateFixture } from './paginate';

export const USERS_PATH = '/api/users';

export const emailTaken = {
  statusCode: 409,
  code: USER_ERROR_CODES.EMAIL_TAKEN,
  message: 'Email is already in use',
  errors: [
    {
      path: 'email',
      message: 'Email is already in use',
      code: USER_ERROR_CODES.EMAIL_TAKEN,
    },
  ],
} satisfies ErrorResponse;

export const lastAdmin = {
  statusCode: 409,
  code: USER_ERROR_CODES.LAST_ADMIN,
  message: 'The last active admin cannot be disabled or demoted',
} satisfies ErrorResponse;

const userNotFound = {
  statusCode: 404,
  code: USER_ERROR_CODES.USER_NOT_FOUND,
  message: 'User not found',
} satisfies ErrorResponse;

export function makeUser(
  index: number,
  overrides: Partial<PublicUser> = {},
): PublicUser {
  const id = `01990000-0000-7000-8000-${String(index).padStart(12, '0')}`;
  return {
    id,
    email: `user${index}@example.com`,
    name: `User ${index}`,
    role: 'USER' satisfies Role,
    isActive: true,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

// The signed-in test admin, a second admin, an active user and a disabled
// one.
export function defaultUsers(): PublicUser[] {
  return [
    testUser('ADMIN'),
    makeUser(1, {
      name: 'Grace Admin',
      email: 'grace@example.com',
      role: 'ADMIN',
    }),
    makeUser(2, { name: 'Linus User', email: 'linus@example.com' }),
    makeUser(3, {
      name: 'Dora Disabled',
      email: 'dora@example.com',
      isActive: false,
    }),
  ];
}

type Recorded = { method: string; url: URL; body: unknown };

/**
 * An in-memory /api/users the specs drive like the real one: filters and
 * pages the list the way the api does, and applies every write to `users`,
 * so a refetch shows it. Each request lands in `requests`. A spec that needs
 * a failure prepends its own handler with server.use after calling this.
 */
export function serveUsers(initial: PublicUser[] = defaultUsers()) {
  const state = { users: [...initial], requests: [] as Recorded[] };

  const record = async (request: Request) => {
    const body: unknown =
      request.method === 'GET'
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined);
    state.requests.push({
      method: request.method,
      url: new URL(request.url),
      body,
    });
  };

  const find = (id: unknown) => state.users.find((user) => user.id === id);

  const replace = (id: string, patch: Partial<PublicUser>) => {
    state.users = state.users.map((user) =>
      user.id === id ? { ...user, ...patch } : user,
    );
    return find(id)!;
  };

  server.use(
    http.get(USERS_PATH, async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const search = params.get('search')?.toLowerCase();
      const roles = params.getAll('role');
      const isActive = params.get('isActive');
      const found = state.users.filter(
        (user) =>
          (!search ||
            `${user.name} ${user.email}`.toLowerCase().includes(search)) &&
          (roles.length === 0 || roles.includes(user.role)) &&
          (isActive === null || String(user.isActive) === isActive),
      );
      return HttpResponse.json(
        paginateFixture(
          found,
          Number(params.get('page') ?? 1),
          Number(params.get('limit') ?? 20),
        ),
      );
    }),

    http.get(`${USERS_PATH}/:id`, async ({ request, params }) => {
      await record(request);
      const user = find(params.id);
      return user
        ? HttpResponse.json({ data: user })
        : HttpResponse.json(userNotFound, { status: 404 });
    }),

    http.post(USERS_PATH, async ({ request }) => {
      await record(request);
      const body = (await request.json()) as Pick<
        PublicUser,
        'email' | 'name' | 'role'
      >;
      if (state.users.some((user) => user.email === body.email)) {
        return HttpResponse.json(emailTaken, { status: 409 });
      }
      const created = makeUser(state.users.length + 100, {
        email: body.email,
        name: body.name,
        role: body.role,
      });
      state.users = [...state.users, created];
      return HttpResponse.json({ data: created }, { status: 201 });
    }),

    http.patch(`${USERS_PATH}/:id`, async ({ request, params }) => {
      await record(request);
      const id = String(params.id);
      if (!find(id)) return HttpResponse.json(userNotFound, { status: 404 });
      const body = (await request.json()) as Partial<PublicUser>;
      return HttpResponse.json({ data: replace(id, body) });
    }),

    http.post(`${USERS_PATH}/:id/disable`, async ({ request, params }) => {
      await record(request);
      return HttpResponse.json({
        data: replace(String(params.id), { isActive: false }),
      });
    }),

    http.post(`${USERS_PATH}/:id/enable`, async ({ request, params }) => {
      await record(request);
      return HttpResponse.json({
        data: replace(String(params.id), { isActive: true }),
      });
    }),

    http.post(`${USERS_PATH}/:id/password`, async ({ request }) => {
      await record(request);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    requests: state.requests,
    get users() {
      return state.users;
    },
    // The list requests' query strings, in order.
    listQueries: () =>
      state.requests
        .filter(
          ({ method, url }) => method === 'GET' && url.pathname === USERS_PATH,
        )
        .map(({ url }) => url.searchParams),
    bodiesOf: (method: string, pathname: string) =>
      state.requests
        .filter(
          (request) =>
            request.method === method && request.url.pathname === pathname,
        )
        .map(({ body }) => body),
  };
}

// By the name's text rather than findByRole('row', { name }): computing
// every row's accessible name is slow enough to time out under a full
// parallel run.
export async function findUserRow(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name, { selector: 'a' });
  const row = cell.closest('tr');
  if (!row) throw new Error(`${name} is not in a table row`);
  return row;
}

// Route chunks import the form and table systems, which can outlast a test's
// budget on first import under a parallel run. Specs warm them in beforeAll.
export async function preloadRoutes(routes: readonly AppRouteObject[]) {
  for (const route of routes) {
    await route.lazy?.();
    if (route.children) await preloadRoutes(route.children);
  }
}
