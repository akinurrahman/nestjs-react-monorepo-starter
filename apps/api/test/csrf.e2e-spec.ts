import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from './../src/database/prisma.service.js';
import { createApp, createUser, loginCookie, refresh } from './auth-helpers.js';

let app: NestExpressApplication;
let prisma: PrismaService;

beforeEach(async () => {
  ({ app, prisma } = await createApp());
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

// Passing the check means reaching the handler, which answers 401 with no
// cookie.
describe('CSRF protection (e2e)', () => {
  it('rejects a cross-site POST /api/auth/refresh with 403', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Origin', 'https://evil.example')
      .expect(403)
      .expect({ statusCode: 403, code: 'FORBIDDEN', message: 'Access denied' });
  });

  it('rejects a same-site (sibling subdomain) POST too', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Sec-Fetch-Site', 'same-site')
      .expect(403);
  });

  it('lets a same-origin POST through', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(401);
  });

  it('lets a POST with no browser headers through', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('trusts the CORS origins', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Origin', 'http://localhost:5173')
      .expect(401);
  });

  it('a real refresh works with same-origin headers', async () => {
    const user = await createUser(prisma);
    const { cookie } = await loginCookie(app, user.email);
    await refresh(app, cookie).set('Sec-Fetch-Site', 'same-origin').expect(200);
  });
});
