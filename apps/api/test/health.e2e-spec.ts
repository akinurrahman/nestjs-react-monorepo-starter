import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.config.js';

describe('Health status (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers GET /api/health/status with no session, after a real database ping', () => {
    return request(app.getHttpServer())
      .get('/api/health/status')
      .expect(200)
      .expect({ data: { status: 'ok', checks: { database: 'ok' } } });
  });

  it('is throttled like any app route, unlike the probes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health/status')
      .expect(200);

    expect(res.headers).toHaveProperty('x-ratelimit-limit');
  });

  it('is not served unprefixed', () => {
    return request(app.getHttpServer()).get('/health/status').expect(404);
  });
});
