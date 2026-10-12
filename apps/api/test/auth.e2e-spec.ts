import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { RATE_LIMIT } from './../src/config/throttler.config.js';
import type { PrismaService } from './../src/database/prisma.service.js';
import {
  cookieHeader,
  createApp,
  createUser,
  login,
  loginCookie,
  PASSWORD,
  refresh,
  refreshCookie,
  sessionIdOf,
  uniqueEmail,
} from './auth-helpers.js';

const INVALID_CREDENTIALS = {
  statusCode: 401,
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
};

const INVALID_SESSION = {
  statusCode: 401,
  code: 'INVALID_SESSION',
  message: 'Session expired, log in again',
};

const REFRESH_TTL = 604_800;
const GRACE_MS = 30_000;

let app: NestExpressApplication;
let prisma: PrismaService;

beforeEach(async () => {
  ({ app, prisma } = await createApp());
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/login', () => {
  it('returns a token and the user, and sets the refresh cookie', async () => {
    const user = await createUser(prisma);

    const res = await login(app, user.email)
      .set('User-Agent', 'e2e-agent')
      .expect(200);

    const body = res.body as {
      data: { accessToken: string; user: Record<string, unknown> };
    };
    expect(body.data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.data.user).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'USER',
      isActive: true,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain('$argon2');

    const cookie = refreshCookie(res);
    expect(cookie?.value).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(cookie?.attributes).toEqual({
      'max-age': String(REFRESH_TTL),
      path: '/api/auth',
      httponly: true,
      secure: true,
      samesite: 'Strict',
    });

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(cookie!.value) },
    });
    expect(session).toMatchObject({
      userId: user.id,
      userAgent: 'e2e-agent',
      revokedAt: null,
    });
    expect(session.ip).toEqual(expect.any(String));
    // Only the hash is stored.
    expect(session.tokenHash).not.toContain(cookie!.value.split('.')[1]);
  });

  it('accepts the email in any case and with spaces', async () => {
    const user = await createUser(prisma);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `  ${user.email.toUpperCase()} `, password: PASSWORD })
      .expect(200);
  });

  it('gives a wrong password, an unknown email and an inactive user the same 401', async () => {
    const active = await createUser(prisma);
    const inactive = await createUser(prisma, { isActive: false });

    const attempts = [
      { email: active.email, password: 'wrong password' },
      { email: uniqueEmail(), password: PASSWORD },
      { email: inactive.email, password: PASSWORD },
    ];
    for (const body of attempts) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(body)
        .expect(401)
        .expect(INVALID_CREDENTIALS);
      expect(refreshCookie(res)).toBeUndefined();
    }
  });

  it.each([
    ['no body', undefined],
    ['an invalid email', { email: 'not-an-email', password: PASSWORD }],
    ['a missing password', { email: 'a@example.com' }],
    ['an empty password', { email: 'a@example.com', password: '' }],
  ])('answers 400 VALIDATION_FAILED for %s', async (_, body) => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(body)
      .expect(400)
      .expect((res) => {
        expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
      });
  });

  it('answers 400 for an unknown field, even with valid credentials', async () => {
    const user = await createUser(prisma);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD, remember: true })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: [
          {
            path: '',
            message: 'Unrecognized key: "remember"',
            code: 'unrecognized_keys',
          },
        ],
      });
  });

  it('limits attempts per ip and email, leaving other emails from that ip alone', async () => {
    const target = await createUser(prisma);
    const colleague = await createUser(prisma);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: target.email, password: 'wrong' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .expect(429)
      .expect((res) => {
        expect((res.body as { code: string }).code).toBe('TOO_MANY_REQUESTS');
      });
    // Another spelling of the same address is the same bucket.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: target.email.toUpperCase(), password: PASSWORD })
      .expect(429);

    await login(app, colleague.email).expect(200);
  });

  // Password spraying: one password against many emails. Each email has
  // its own ip and email bucket, so only the global per-IP limit stops it.
  it('keeps the per-ip limit across different emails', async () => {
    for (let i = 0; i < RATE_LIMIT.limit; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `spray${i}@example.com`, password: 'Password1' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'spray-last@example.com', password: 'Password1' })
      .expect(429)
      .expect((res) => {
        expect((res.body as { code: string }).code).toBe('TOO_MANY_REQUESTS');
      });
  });

  it("deletes the user's revoked and expired sessions", async () => {
    const user = await createUser(prisma);
    const revoked = await loginCookie(app, user.email);
    const expired = await loginCookie(app, user.email);
    const live = await loginCookie(app, user.email);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(revoked.cookie))
      .expect(204);
    await prisma.session.update({
      where: { id: sessionIdOf(expired.cookie) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await login(app, user.email).expect(200);

    const ids = (
      await prisma.session.findMany({ where: { userId: user.id } })
    ).map((s) => s.id);
    expect(ids).not.toContain(sessionIdOf(revoked.cookie));
    expect(ids).not.toContain(sessionIdOf(expired.cookie));
    expect(ids).toContain(sessionIdOf(live.cookie));
    expect(ids).toHaveLength(2);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new token and rotates the cookie', async () => {
    const user = await createUser(prisma);
    const first = await loginCookie(app, user.email);
    const before = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(first.cookie) },
    });

    // Tokens issued in the same second are identical, so wait one out.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const res = await refresh(app, first.cookie).expect(200);

    const body = res.body as {
      data: { accessToken: string; user: { id: string } };
    };
    expect(body.data.accessToken).not.toBe(first.accessToken);
    expect(body.data.user.id).toBe(user.id);
    expect(res.text).not.toContain('passwordHash');

    const next = refreshCookie(res);
    expect(next?.value).not.toBe(first.cookie);
    expect(sessionIdOf(next!.value)).toBe(sessionIdOf(first.cookie));
    expect(next?.attributes).toMatchObject({
      path: '/api/auth',
      httponly: true,
      secure: true,
      samesite: 'Strict',
    });

    const after = await prisma.session.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after.tokenHash).not.toBe(before.tokenHash);
    expect(after.previousTokenHash).toBe(before.tokenHash);
    expect(after.lastUsedAt.getTime()).toBeGreaterThan(
      before.lastUsedAt.getTime(),
    );
    // Sliding expiry: pushed out to now + the refresh TTL again.
    expect(after.expiresAt.getTime()).toBeGreaterThan(
      before.expiresAt.getTime(),
    );
  });

  it('accepts the replaced cookie within the grace window, without rotating', async () => {
    const user = await createUser(prisma);
    const { cookie: old } = await loginCookie(app, user.email);
    const rotated = refreshCookie(await refresh(app, old).expect(200))!.value;
    const before = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(old) },
    });

    const res = await refresh(app, old).expect(200);

    expect(
      (res.body as { data: { accessToken: string } }).data.accessToken,
    ).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();
    const after = await prisma.session.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after.tokenHash).toBe(before.tokenHash);
    expect(after.revokedAt).toBeNull();

    // The rotated cookie is still the current one.
    await refresh(app, rotated).expect(200);
  });

  it('treats the replaced cookie after the grace window as reuse: 401 and the session is revoked', async () => {
    const user = await createUser(prisma);
    const { cookie: old } = await loginCookie(app, user.email);
    const rotated = refreshCookie(await refresh(app, old).expect(200))!.value;
    await prisma.session.update({
      where: { id: sessionIdOf(old) },
      data: { rotatedAt: new Date(Date.now() - GRACE_MS - 1000) },
    });

    await refresh(app, old).expect(401).expect(INVALID_SESSION);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(old) },
    });
    expect(session.revokedAt).not.toBeNull();
    await refresh(app, rotated).expect(401).expect(INVALID_SESSION);
  });

  it('treats a secret the session never had as reuse', async () => {
    const user = await createUser(prisma);
    const { cookie } = await loginCookie(app, user.email);
    const forged = `${sessionIdOf(cookie)}.${'A'.repeat(43)}`;

    await refresh(app, forged).expect(401).expect(INVALID_SESSION);

    await refresh(app, cookie).expect(401).expect(INVALID_SESSION);
  });

  it('answers 401 for an expired session', async () => {
    const user = await createUser(prisma);
    const { cookie } = await loginCookie(app, user.email);
    await prisma.session.update({
      where: { id: sessionIdOf(cookie) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await refresh(app, cookie).expect(401).expect(INVALID_SESSION);
  });

  it('answers 401 once the user is deactivated', async () => {
    const user = await createUser(prisma);
    const { cookie } = await loginCookie(app, user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    await refresh(app, cookie).expect(401).expect(INVALID_SESSION);
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
    ['garbage', 'garbage'],
    ['a non-uuid session id', `not-a-uuid.${'A'.repeat(43)}`],
    ['a short secret', '019a1b2c-3d4e-7f00-8a00-0123456789ab.short'],
    [
      'an unknown session',
      `019a1b2c-3d4e-7f00-8a00-0123456789ab.${'A'.repeat(43)}`,
    ],
    ['percent-encoded junk', '%E0%A4%A'],
  ])('answers 401, never 500, for %s', async (_, cookie) => {
    await refresh(app, cookie).expect(401).expect(INVALID_SESSION);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const user = await createUser(prisma);
    const { cookie, accessToken } = await loginCookie(app, user.email);

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(cookie))
      .expect(204);

    const cleared = refreshCookie(res);
    expect(cleared?.value).toBe('');
    expect(cleared?.attributes).toMatchObject({ path: '/api/auth' });
    const expires = cleared?.attributes['expires'];
    expect(
      cleared?.attributes['max-age'] === '0' ||
        (typeof expires === 'string' && new Date(expires) <= new Date()),
    ).toBe(true);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(cookie) },
    });
    expect(session.revokedAt).not.toBeNull();
    await refresh(app, cookie).expect(401);

    // Accepted tradeoff: the access token works until it expires.
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it.each([
    ['no cookie', undefined],
    ['a malformed cookie', 'garbage'],
  ])('succeeds with %s', async (_, cookie) => {
    const req = request(app.getHttpServer()).post('/api/auth/logout');
    const res = await (
      cookie === undefined ? req : req.set('Cookie', cookieHeader(cookie))
    ).expect(204);
    expect(refreshCookie(res)?.value).toBe('');
  });

  it('does not revoke a session for a cookie with the wrong secret', async () => {
    const user = await createUser(prisma);
    const { cookie } = await loginCookie(app, user.email);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(`${sessionIdOf(cookie)}.${'A'.repeat(43)}`))
      .expect(204);

    await refresh(app, cookie).expect(200);
  });
});

describe('GET /api/auth/me', () => {
  it('answers 401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401).expect({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  });

  it('returns the user, read fresh, without the password hash', async () => {
    const user = await createUser(prisma);
    const { accessToken } = await loginCookie(app, user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { name: 'Renamed' },
    });

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ id: user.id, name: 'Renamed', role: 'USER' });
    expect(Object.keys(data).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'isActive',
      'name',
      'role',
      'updatedAt',
    ]);
    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain('$argon2');
  });

  it('answers 401 once the user is deactivated', async () => {
    const user = await createUser(prisma);
    const { accessToken } = await loginCookie(app, user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});

describe('API docs', () => {
  it('require the bearer token by default and not on public routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const doc = res.body as {
      security?: unknown;
      components: { securitySchemes?: Record<string, unknown> };
      paths: Record<string, Record<string, { security?: unknown }>>;
    };

    expect(doc.security).toEqual([{ bearer: [] }]);
    expect(doc.components.securitySchemes?.['bearer']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(doc.paths['/api/auth/me']?.['get']?.security).toBeUndefined();
    for (const [path, method] of [
      ['/api/auth/login', 'post'],
      ['/api/auth/refresh', 'post'],
      ['/api/auth/logout', 'post'],
      ['/health', 'get'],
      ['/health/ready', 'get'],
      ['/api/health/status', 'get'],
    ] as const) {
      expect(doc.paths[path]?.[method]?.security).toEqual([{}]);
    }
  });
});
