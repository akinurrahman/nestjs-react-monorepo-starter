import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from './../src/database/prisma.service.js';
import {
  createApp,
  createUser,
  PASSWORD,
  refreshCookie,
  sessionIdOf,
} from './auth-helpers.js';

let app: NestExpressApplication;
let prisma: PrismaService;

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

async function loginIp(forwardedFor: string) {
  const user = await createUser(prisma);
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .set('X-Forwarded-For', forwardedFor)
    .send({ email: user.email, password: PASSWORD })
    .expect(200);
  const id = sessionIdOf(refreshCookie(res)!.value);
  return (await prisma.session.findUniqueOrThrow({ where: { id } })).ip;
}

describe('Session ip and TRUST_PROXY (e2e)', () => {
  it('stores the forwarded client ip when TRUST_PROXY is set', async () => {
    ({ app, prisma } = await createApp({ env: { TRUST_PROXY: '1' } }));
    expect(await loginIp('203.0.113.7')).toBe('203.0.113.7');
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is unset', async () => {
    ({ app, prisma } = await createApp());
    const ip = await loginIp('203.0.113.7');
    expect(ip).not.toBe('203.0.113.7');
    expect(ip).toMatch(/127\.0\.0\.1|::1/);
  });
});
