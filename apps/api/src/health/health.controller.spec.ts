import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../config/app.config.js';
import { PrismaService } from '../database/prisma.service.js';
import { HealthRepository } from './health.repository.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const CAUSE = 'connect ECONNREFUSED 10.0.0.5:5432 user=postgres';

// AppModule validates env when it is imported, so it is loaded after the env
// is stubbed. PrismaService and HealthRepository are replaced: no database.
describe('Health endpoints', () => {
  const ping = vi.fn<() => Promise<void>>();
  let app: NestExpressApplication;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/unused');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-0123456789abcdef');
    const { AppModule } = await import('../app.module.js');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(HealthRepository)
      .useValue({ ping })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    await configureApp(app);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    ping.mockReset();
  });

  it('GET /health is ok without pinging the database', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ data: { status: 'ok' } });

    expect(ping).not.toHaveBeenCalled();
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('GET /health/ready is ok when the database answers', async () => {
    ping.mockResolvedValue();

    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ data: { status: 'ok', checks: { database: 'ok' } } });

    expect(ping).toHaveBeenCalledTimes(1);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('GET /health/ready is 503 without leaking the cause', async () => {
    ping.mockRejectedValue(new Error(CAUSE));

    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
      });

    expect(res.text).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|postgres|stack/i);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('GET /api/health/status is ok when the database answers', async () => {
    ping.mockResolvedValue();

    await request(app.getHttpServer())
      .get('/api/health/status')
      .expect(200)
      .expect({ data: { status: 'ok', checks: { database: 'ok' } } });

    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('GET /api/health/status is 503 SERVICE_UNAVAILABLE when the database is down', async () => {
    ping.mockRejectedValue(new Error(CAUSE));

    const res = await request(app.getHttpServer())
      .get('/api/health/status')
      .expect(503)
      .expect({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
      });

    expect(res.text).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|postgres|stack/i);
  });
});
