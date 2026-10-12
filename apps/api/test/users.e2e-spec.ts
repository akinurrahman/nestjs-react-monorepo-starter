import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role } from '@starter/shared';
import request from 'supertest';
import { createSwaggerDocument } from './../src/config/swagger.config.js';
import type { PrismaService } from './../src/database/prisma.service.js';
import {
  createApp,
  createUser,
  login,
  loginCookie,
  PASSWORD,
  refresh,
  sessionIdOf,
  uniqueEmail,
} from './auth-helpers.js';
import { readTestDatabaseUrl, truncateAppTables } from './test-db.js';

const UNKNOWN_ID = '019a0000-0000-7000-8000-000000000000';
const NEW_PASSWORD = 'a brand new password';

let app: NestExpressApplication;
let prisma: PrismaService;

// The last admin rules count every admin in the database, so each test
// starts from an empty one.
beforeEach(async () => {
  await truncateAppTables(readTestDatabaseUrl());
  ({ app, prisma } = await createApp());
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

const api = () => request(app.getHttpServer());

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function signIn(
  options: { role?: Role; name?: string; email?: string } = {},
) {
  const user = await createUser(prisma, { role: 'ADMIN', ...options });
  const { accessToken, cookie } = await loginCookie(app, user.email);
  return { user, token: accessToken, cookie, headers: bearer(accessToken) };
}

const signInAdmin = () => signIn({ role: 'ADMIN' });
const signInUser = () => signIn({ role: 'USER' });

async function isRevoked(cookie: string): Promise<boolean> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionIdOf(cookie) },
  });
  return session.revokedAt !== null;
}

function expectNoSecrets(res: request.Response) {
  expect(res.text).not.toContain('passwordHash');
  expect(res.text).not.toContain('$argon2');
}

// The checks every admin route shares: no token, a USER token, a bad id.
describe.each([
  ['GET', '/api/users'],
  ['GET', `/api/users/${UNKNOWN_ID}`],
  ['POST', '/api/users'],
  ['PATCH', `/api/users/${UNKNOWN_ID}`],
  ['POST', `/api/users/${UNKNOWN_ID}/disable`],
  ['POST', `/api/users/${UNKNOWN_ID}/enable`],
  ['POST', `/api/users/${UNKNOWN_ID}/password`],
] as const)('%s %s (access)', (method, path) => {
  const send = () =>
    method === 'GET'
      ? api().get(path)
      : method === 'POST'
        ? api().post(path)
        : api().patch(path);

  it('answers 401 without a token', async () => {
    await send().expect(401).expect({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  });

  it('answers 403 for a USER token', async () => {
    const { headers } = await signInUser();
    await send().set(headers).expect(403).expect({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Access denied',
    });
  });
});

// The body is valid for the route, so the id is the only error.
describe.each([
  ['GET', '/api/users/not-a-uuid', undefined],
  ['PATCH', '/api/users/not-a-uuid', { name: 'x' }],
  ['POST', '/api/users/not-a-uuid/disable', undefined],
  ['POST', '/api/users/not-a-uuid/enable', undefined],
  ['POST', '/api/users/not-a-uuid/password', { password: NEW_PASSWORD }],
] as const)('%s %s (bad id)', (method, path, body) => {
  it('answers 400 on the id', async () => {
    const { headers } = await signInAdmin();
    const req =
      method === 'GET'
        ? api().get(path)
        : method === 'POST'
          ? api().post(path)
          : api().patch(path);

    const res = await req.set(headers).send(body).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ path: 'id' })],
    });
  });
});

describe.each([
  ['GET', ''],
  ['PATCH', ''],
  ['POST', '/disable'],
  ['POST', '/enable'],
  ['POST', '/password'],
] as const)('%s /api/users/:id%s (unknown id)', (method, suffix) => {
  it('answers 404 USER_NOT_FOUND', async () => {
    const { headers } = await signInAdmin();
    const path = `/api/users/${UNKNOWN_ID}${suffix}`;
    const req =
      method === 'GET'
        ? api().get(path)
        : method === 'POST'
          ? api().post(path)
          : api().patch(path);

    await req
      .set(headers)
      .send(suffix === '/password' ? { password: NEW_PASSWORD } : { name: 'x' })
      .expect(404)
      .expect({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
  });
});

describe('GET /api/users', () => {
  it('pages newest first with the pagination fields', async () => {
    const { headers, user: admin } = await signInAdmin();
    const first = await createUser(prisma);
    const second = await createUser(prisma);
    const third = await createUser(prisma);

    const res = await api()
      .get('/api/users?page=1&limit=2')
      .set(headers)
      .expect(200);

    const body = res.body as {
      data: { id: string }[];
      pagination: Record<string, unknown>;
    };
    expect(body.data.map((u) => u.id)).toEqual([third.id, second.id]);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
      hasPrevious: false,
      hasNext: true,
    });
    expectNoSecrets(res);

    const page2 = await api()
      .get('/api/users?page=2&limit=2')
      .set(headers)
      .expect(200);
    expect((page2.body as typeof body).data.map((u) => u.id)).toEqual([
      first.id,
      admin.id,
    ]);
  });

  it('returns the public shape of each user', async () => {
    const { headers, user } = await signInAdmin();

    const res = await api().get('/api/users').set(headers).expect(200);

    expect((res.body as { data: unknown[] }).data).toEqual([
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'ADMIN',
        isActive: true,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    ]);
  });

  it('searches name or email, ignoring case', async () => {
    const { headers } = await signInAdmin();
    const byName = await createUser(prisma, { name: 'Ada Lovelace' });
    const byEmail = await createUser(prisma, {
      name: 'Bob',
      email: `bob.adams-${Date.now()}@example.com`,
    });
    await createUser(prisma, { name: 'Grace Hopper' });

    const res = await api()
      .get('/api/users?search=ADA')
      .set(headers)
      .expect(200);

    const ids = (res.body as { data: { id: string }[] }).data.map((u) => u.id);
    expect(ids.sort()).toEqual([byName.id, byEmail.id].sort());
  });

  it('treats LIKE wildcards in the search as plain text', async () => {
    const { headers } = await signInAdmin();
    const literal = await createUser(prisma, { name: '100% done' });

    for (const search of ['%25', '_']) {
      const res = await api()
        .get(`/api/users?search=${search}`)
        .set(headers)
        .expect(200);
      const ids = (res.body as { data: { id: string }[] }).data.map(
        (u) => u.id,
      );
      expect(ids).toEqual(search === '%25' ? [literal.id] : []);
    }
  });

  it('filters by one role and by two', async () => {
    const { headers, user: admin } = await signInAdmin();
    const user = await createUser(prisma);

    const one = await api()
      .get('/api/users?role=USER')
      .set(headers)
      .expect(200);
    expect(
      (one.body as { data: { id: string }[] }).data.map((u) => u.id),
    ).toEqual([user.id]);

    const two = await api()
      .get('/api/users?role=USER&role=ADMIN')
      .set(headers)
      .expect(200);
    expect(
      (two.body as { data: { id: string }[] }).data.map((u) => u.id).sort(),
    ).toEqual([admin.id, user.id].sort());
  });

  it('filters by isActive=true and isActive=false', async () => {
    const { headers, user: admin } = await signInAdmin();
    const inactive = await createUser(prisma, { isActive: false });

    const active = await api()
      .get('/api/users?isActive=true')
      .set(headers)
      .expect(200);
    expect(
      (active.body as { data: { id: string }[] }).data.map((u) => u.id),
    ).toEqual([admin.id]);

    const disabled = await api()
      .get('/api/users?isActive=false')
      .set(headers)
      .expect(200);
    expect(
      (disabled.body as { data: { id: string }[] }).data.map((u) => u.id),
    ).toEqual([inactive.id]);
  });

  it.each([
    ['isActive=yes', 'isActive'],
    ['role=OWNER', 'role.0'],
    ['limit=0', 'limit'],
    ['page=abc', 'page'],
  ])('answers 400 for %s', async (query, path) => {
    const { headers } = await signInAdmin();

    const res = await api().get(`/api/users?${query}`).set(headers).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ path })],
    });
  });

  it('documents the filters as query params', async () => {
    await app.init();
    const params = createSwaggerDocument(app).paths['/api/users']?.get
      ?.parameters as { name: string; schema: unknown }[];

    expect(params.map((p) => p.name).sort()).toEqual(
      ['isActive', 'limit', 'page', 'role', 'search'].sort(),
    );
    expect(params.find((p) => p.name === 'role')?.schema).toEqual({
      type: 'array',
      items: { type: 'string', enum: ['ADMIN', 'USER'] },
    });
    expect(params.find((p) => p.name === 'isActive')?.schema).toMatchObject({
      type: 'string',
    });
  });
});

describe('GET /api/users/:id', () => {
  it('returns the user', async () => {
    const { headers } = await signInAdmin();
    const user = await createUser(prisma);

    const res = await api()
      .get(`/api/users/${user.id}`)
      .set(headers)
      .expect(200);

    expect(res.body).toEqual({
      data: expect.objectContaining({ id: user.id, email: user.email }),
    });
    expectNoSecrets(res);
  });
});

describe('POST /api/users', () => {
  const body = () => ({
    email: `  New.${uniqueEmail().toUpperCase()} `,
    name: ' New User ',
    role: 'USER',
    password: NEW_PASSWORD,
  });

  it('creates the user, who can then log in', async () => {
    const { headers } = await signInAdmin();
    const input = body();

    const res = await api()
      .post('/api/users')
      .set(headers)
      .send(input)
      .expect(201);

    const email = input.email.trim().toLowerCase();
    expect(res.body).toEqual({
      data: {
        id: expect.any(String),
        email,
        name: 'New User',
        role: 'USER',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    expectNoSecrets(res);
    await api()
      .post('/api/auth/login')
      .send({ email, password: NEW_PASSWORD })
      .expect(200);
  });

  it('answers 409 EMAIL_TAKEN with a field error, whatever the case', async () => {
    const { headers } = await signInAdmin();
    const existing = await createUser(prisma);

    await api()
      .post('/api/users')
      .set(headers)
      .send({ ...body(), email: existing.email.toUpperCase() })
      .expect(409)
      .expect({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'Email is already in use',
        errors: [
          {
            path: 'email',
            message: 'Email is already in use',
            code: 'EMAIL_TAKEN',
          },
        ],
      });
  });

  it.each([
    ['a short password', { password: 'x'.repeat(7) }, 'password'],
    ['an invalid email', { email: 'nope' }, 'email'],
    ['an unknown role', { role: 'OWNER' }, 'role'],
    ['an unknown field', { isActive: false }, ''],
  ])('answers 400 for %s', async (_, patch, path) => {
    const { headers } = await signInAdmin();

    const res = await api()
      .post('/api/users')
      .set(headers)
      .send({ ...body(), ...patch })
      .expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ path })],
    });
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates name and email', async () => {
    const { headers } = await signInAdmin();
    const user = await createUser(prisma);
    const email = uniqueEmail();

    const res = await api()
      .patch(`/api/users/${user.id}`)
      .set(headers)
      .send({ name: 'Renamed', email: email.toUpperCase() })
      .expect(200);

    expect(res.body).toMatchObject({ data: { name: 'Renamed', email } });
  });

  it('keeps sessions on a change that is not the role', async () => {
    const { headers } = await signInAdmin();
    const target = await signInUser();

    await api()
      .patch(`/api/users/${target.user.id}`)
      .set(headers)
      .send({ name: 'Renamed' })
      .expect(200);

    expect(await isRevoked(target.cookie)).toBe(false);
  });

  it('revokes the sessions of a user whose role changes', async () => {
    const { headers } = await signInAdmin();
    const target = await signInUser();

    await api()
      .patch(`/api/users/${target.user.id}`)
      .set(headers)
      .send({ role: 'ADMIN' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ data: { role: 'ADMIN' } }),
      );

    expect(await isRevoked(target.cookie)).toBe(true);
    await refresh(app, target.cookie).expect(401);
  });

  it('answers 409 EMAIL_TAKEN for another user email', async () => {
    const { headers, user: admin } = await signInAdmin();
    const user = await createUser(prisma);

    const res = await api()
      .patch(`/api/users/${user.id}`)
      .set(headers)
      .send({ email: admin.email })
      .expect(409);
    expect(res.body).toMatchObject({
      code: 'EMAIL_TAKEN',
      errors: [{ path: 'email', code: 'EMAIL_TAKEN' }],
    });
  });

  it.each([
    ['an empty body', {}],
    ['an unknown field', { isActive: false }],
    ['a password', { password: NEW_PASSWORD }],
  ])('answers 400 for %s', async (_, body) => {
    const { headers } = await signInAdmin();
    const user = await createUser(prisma);

    await api()
      .patch(`/api/users/${user.id}`)
      .set(headers)
      .send(body)
      .expect(400)
      .expect((res) =>
        expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' }),
      );
  });

  it('answers 403 CANNOT_CHANGE_OWN_ROLE for the caller', async () => {
    const { headers, user } = await signInAdmin();
    await createUser(prisma, { role: 'ADMIN' });

    await api()
      .patch(`/api/users/${user.id}`)
      .set(headers)
      .send({ role: 'USER' })
      .expect(403)
      .expect({
        statusCode: 403,
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'You cannot change your own role',
      });
  });

  it('lets the caller resend their own role with other changes', async () => {
    const { headers, user } = await signInAdmin();

    await api()
      .patch(`/api/users/${user.id}`)
      .set(headers)
      .send({ role: 'ADMIN', name: 'Still Admin' })
      .expect(200);
  });

  // The caller passes the role guard on their token, but was disabled in the
  // database since, so the target is the only active admin left. The access
  // token outliving a disable is the accepted window of a stateless token.
  it('answers 409 LAST_ADMIN when demoting the last active admin', async () => {
    const caller = await signInAdmin();
    const last = await createUser(prisma, { role: 'ADMIN' });
    await prisma.user.update({
      where: { id: caller.user.id },
      data: { isActive: false },
    });

    await api()
      .patch(`/api/users/${last.id}`)
      .set(caller.headers)
      .send({ role: 'USER' })
      .expect(409)
      .expect({
        statusCode: 409,
        code: 'LAST_ADMIN',
        message: 'The last active admin cannot be disabled or demoted',
      });
  });
});

describe('POST /api/users/:id/disable', () => {
  it('disables the user, revokes their sessions and blocks login', async () => {
    const { headers } = await signInAdmin();
    const target = await signInUser();

    const res = await api()
      .post(`/api/users/${target.user.id}/disable`)
      .set(headers)
      .expect(200);

    expect(res.body).toMatchObject({ data: { isActive: false } });
    expect(await isRevoked(target.cookie)).toBe(true);
    await refresh(app, target.cookie).expect(401);
    await login(app, target.user.email)
      .expect(401)
      .expect((r) =>
        expect(r.body).toMatchObject({ code: 'INVALID_CREDENTIALS' }),
      );
  });

  it('answers 403 CANNOT_DISABLE_SELF for the caller', async () => {
    const { headers, user } = await signInAdmin();
    await createUser(prisma, { role: 'ADMIN' });

    await api()
      .post(`/api/users/${user.id}/disable`)
      .set(headers)
      .expect(403)
      .expect({
        statusCode: 403,
        code: 'CANNOT_DISABLE_SELF',
        message: 'You cannot disable your own account',
      });
  });

  it('disables another admin while one stays active', async () => {
    const { headers } = await signInAdmin();
    const other = await createUser(prisma, { role: 'ADMIN' });

    await api().post(`/api/users/${other.id}/disable`).set(headers).expect(200);
  });

  // See the LAST_ADMIN test under PATCH for how the caller gets here.
  it('answers 409 LAST_ADMIN for the last active admin', async () => {
    const caller = await signInAdmin();
    const last = await createUser(prisma, { role: 'ADMIN' });
    await prisma.user.update({
      where: { id: caller.user.id },
      data: { isActive: false },
    });

    await api()
      .post(`/api/users/${last.id}/disable`)
      .set(caller.headers)
      .expect(409)
      .expect((res) => expect(res.body).toMatchObject({ code: 'LAST_ADMIN' }));
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: last.id },
    });
    expect(stored.isActive).toBe(true);
  });
});

describe('POST /api/users/:id/enable', () => {
  it('enables the user, who can log in again', async () => {
    const { headers } = await signInAdmin();
    const user = await createUser(prisma, { isActive: false });
    await login(app, user.email).expect(401);

    const res = await api()
      .post(`/api/users/${user.id}/enable`)
      .set(headers)
      .expect(200);

    expect(res.body).toMatchObject({ data: { isActive: true } });
    await login(app, user.email).expect(200);
  });
});

describe('POST /api/users/:id/password', () => {
  it('sets the password and revokes the sessions', async () => {
    const { headers } = await signInAdmin();
    const target = await signInUser();

    await api()
      .post(`/api/users/${target.user.id}/password`)
      .set(headers)
      .send({ password: NEW_PASSWORD })
      .expect(204);

    expect(await isRevoked(target.cookie)).toBe(true);
    await refresh(app, target.cookie).expect(401);
    await login(app, target.user.email).expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: target.user.email, password: NEW_PASSWORD })
      .expect(200);
  });

  it.each([
    ['a short password', { password: 'x'.repeat(7) }],
    ['an unknown field', { password: NEW_PASSWORD, revoke: false }],
  ])('answers 400 for %s', async (_, body) => {
    const { headers } = await signInAdmin();
    const user = await createUser(prisma);

    await api()
      .post(`/api/users/${user.id}/password`)
      .set(headers)
      .send(body)
      .expect(400);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the caller name, for a USER', async () => {
    const { headers, user } = await signInUser();

    const res = await api()
      .patch('/api/users/me')
      .set(headers)
      .send({ name: '  Me Myself ' })
      .expect(200);

    expect(res.body).toMatchObject({
      data: { id: user.id, name: 'Me Myself' },
    });
    expectNoSecrets(res);
  });

  // Matched before /users/:id, so an admin reaches it too.
  it('works for an ADMIN', async () => {
    const { headers, user } = await signInAdmin();

    await api()
      .patch('/api/users/me')
      .set(headers)
      .send({ name: 'Admin Me' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ data: { id: user.id } }),
      );
  });

  // Rejected rather than stripped: a client sending a role here should
  // learn it is not allowed, not see a 200 that changed nothing.
  it.each([
    ['role', { name: 'Me', role: 'ADMIN' }],
    ['email', { name: 'Me', email: 'other@example.com' }],
  ])('answers 400 for a %s and changes nothing', async (_, body) => {
    const { headers, user } = await signInUser();

    await api().patch('/api/users/me').set(headers).send(body).expect(400);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored).toMatchObject({
      role: 'USER',
      email: user.email,
      name: user.name,
    });
  });

  it('answers 400 for a blank name', async () => {
    const { headers } = await signInUser();
    await api()
      .patch('/api/users/me')
      .set(headers)
      .send({ name: '   ' })
      .expect(400);
  });

  it('answers 401 without a token', async () => {
    await api().patch('/api/users/me').send({ name: 'Me' }).expect(401);
  });
});

describe('POST /api/auth/password', () => {
  it('changes the password, keeps this session and revokes the others', async () => {
    const current = await signInUser();
    const other = await loginCookie(app, current.user.email);

    await api()
      .post('/api/auth/password')
      .set(current.headers)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(204);

    expect(await isRevoked(other.cookie)).toBe(true);
    await refresh(app, other.cookie).expect(401);
    expect(await isRevoked(current.cookie)).toBe(false);
    await refresh(app, current.cookie).expect(200);

    await login(app, current.user.email).expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: current.user.email, password: NEW_PASSWORD })
      .expect(200);
  });

  it('answers a wrong current password with a field error', async () => {
    const { headers, cookie } = await signInUser();

    await api()
      .post('/api/auth/password')
      .set(headers)
      .send({ currentPassword: 'not the password', newPassword: NEW_PASSWORD })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect',
        errors: [
          {
            path: 'currentPassword',
            message: 'Current password is incorrect',
            code: 'INVALID_CURRENT_PASSWORD',
          },
        ],
      });
    expect(await isRevoked(cookie)).toBe(false);
  });

  it.each([
    [
      'a short new password',
      { currentPassword: PASSWORD, newPassword: 'short' },
    ],
    [
      'an unknown field',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, userId: 'x' },
    ],
  ])('answers 400 for %s', async (_, body) => {
    const { headers } = await signInUser();
    await api().post('/api/auth/password').set(headers).send(body).expect(400);
  });

  it('answers 401 without a token', async () => {
    await api()
      .post('/api/auth/password')
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(401);
  });
});
