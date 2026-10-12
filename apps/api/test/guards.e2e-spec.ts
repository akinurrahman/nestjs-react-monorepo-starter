import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { CurrentUser, Roles } from './../src/auth/auth.decorators.js';
import type { AuthUser } from './../src/auth/auth.types.js';
import { createApp } from './auth-helpers.js';
import { readTestEnv } from './test-db.js';

// No @Public(): what any new route gets by default.
@Controller('guards-test')
class GuardsTestController {
  // Nothing on it reads the user, so only the global guard can stop it.
  @Get('plain')
  plain() {
    return { ok: true };
  }

  @Get('private')
  private(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('admin')
  @Roles('ADMIN')
  admin() {
    return { ok: true };
  }
}

const UNAUTHORIZED = {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  message: 'Authentication required',
};

let app: NestExpressApplication;

beforeEach(async () => {
  ({ app } = await createApp({ controllers: [GuardsTestController] }));
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

// Signed by the app's own token service, for ids that are in no table: the
// guard trusts the token alone and never reads the database.
async function tokenFor(role: 'USER' | 'ADMIN') {
  const { AccessTokenService } =
    await import('./../src/auth/access-token.service.js');
  const user: AuthUser = { id: randomUUID(), sessionId: randomUUID(), role };
  return { user, accessToken: await app.get(AccessTokenService).sign(user) };
}

function get(path: string, token?: string) {
  const req = request(app.getHttpServer()).get(path);
  return token === undefined
    ? req
    : req.set('Authorization', `Bearer ${token}`);
}

describe('Deny by default (e2e)', () => {
  it('answers 401 on a route without @Public and no token', async () => {
    await get('/api/guards-test/plain').expect(401).expect(UNAUTHORIZED);
  });

  it('serves that route with a valid token', async () => {
    const { accessToken } = await tokenFor('USER');
    await get('/api/guards-test/plain', accessToken).expect(200);
  });

  it('exposes { id, sessionId, role } through @CurrentUser', async () => {
    const { user, accessToken } = await tokenFor('USER');

    await get('/api/guards-test/private', accessToken)
      .expect(200)
      .expect({ data: user });
  });

  const secret = new TextEncoder().encode(readTestEnv()['JWT_SECRET']);
  const claims = {
    sid: '019a1b2c-3d4e-7f00-8a00-0123456789ab',
    role: 'ADMIN',
  };
  const now = () => Math.floor(Date.now() / 1000);

  it.each([
    ['garbage', async () => 'not.a.token'],
    [
      'an expired token',
      () =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject('019a1b2c-3d4e-7f00-8a00-0123456789ab')
          .setIssuedAt(now() - 120)
          .setExpirationTime(now() - 60)
          .sign(secret),
    ],
    [
      'a token signed with another key',
      () =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject('019a1b2c-3d4e-7f00-8a00-0123456789ab')
          .setExpirationTime(now() + 60)
          .sign(new TextEncoder().encode('x'.repeat(48))),
    ],
    [
      'a token with no expiry',
      () =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject('019a1b2c-3d4e-7f00-8a00-0123456789ab')
          .sign(secret),
    ],
    [
      'an unsigned token',
      async () => {
        const part = (v: object) =>
          Buffer.from(JSON.stringify(v)).toString('base64url');
        return `${part({ alg: 'none' })}.${part({
          ...claims,
          sub: '019a1b2c-3d4e-7f00-8a00-0123456789ab',
          exp: now() + 60,
        })}.`;
      },
    ],
    [
      'a token with an unknown role',
      () =>
        new SignJWT({ ...claims, role: 'OWNER' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject('019a1b2c-3d4e-7f00-8a00-0123456789ab')
          .setExpirationTime(now() + 60)
          .sign(secret),
    ],
  ])('answers 401 for %s', async (_, makeToken) => {
    await get('/api/guards-test/plain', await makeToken())
      .expect(401)
      .expect(UNAUTHORIZED);
  });

  it('answers 401 for another scheme', async () => {
    const { accessToken } = await tokenFor('USER');
    await request(app.getHttpServer())
      .get('/api/guards-test/plain')
      .set('Authorization', `Basic ${accessToken}`)
      .expect(401);
  });

  it('answers 403 FORBIDDEN on an @Roles(ADMIN) route for a user', async () => {
    const { accessToken } = await tokenFor('USER');

    await get('/api/guards-test/admin', accessToken).expect(403).expect({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Access denied',
    });
  });

  it('lets an admin through @Roles(ADMIN)', async () => {
    const { accessToken } = await tokenFor('ADMIN');

    await get('/api/guards-test/admin', accessToken)
      .expect(200)
      .expect({ data: { ok: true } });
  });

  it('answers 401, not 403, on an @Roles route without a token', async () => {
    await get('/api/guards-test/admin').expect(401);
  });

  it.each(['/health', '/health/ready', '/api/health/status'])(
    'keeps %s public',
    async (path) => {
      await get(path).expect(200);
    },
  );
});
