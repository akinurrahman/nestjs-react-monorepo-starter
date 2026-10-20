import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApp } from './auth-helpers.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Request ID (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    ({ app } = await createApp());
  });

  it('generates a UUID when none is sent', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('echoes a valid incoming ID unchanged', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'abc_DEF-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('abc_DEF-123');
  });

  it('replaces an ID containing spaces', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'has spaces')
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('replaces an ID longer than 64 characters', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'a'.repeat(65))
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('accepts an ID of exactly 64 characters', async () => {
    const id = 'a'.repeat(64);
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', id)
      .expect(200);

    expect(res.headers['x-request-id']).toBe(id);
  });

  it('sets the header on a 404 error response', async () => {
    const res = await request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
