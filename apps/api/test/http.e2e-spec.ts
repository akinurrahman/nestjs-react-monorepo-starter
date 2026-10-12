import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { Public } from './../src/auth/auth.decorators.js';
import { DEFAULT_CORS_ORIGINS } from './../src/config/env.schema.js';
import { configureApp } from './../src/config/app.config.js';
import {
  SWAGGER_JSON_PATH,
  SWAGGER_PATH,
} from './../src/config/swagger.config.js';

const ALLOWED_ORIGIN = DEFAULT_CORS_ORIGINS[0];
const DISALLOWED_ORIGIN = 'https://evil.example';

@Public()
@Controller('prefix-test')
class PrefixTestController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('HTTP setup (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PrefixTestController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('global prefix', () => {
    it('serves controllers under /api', () => {
      return request(app.getHttpServer())
        .get('/api/prefix-test')
        .expect(200)
        .expect({ data: { ok: true } });
    });

    it('does not serve controllers without the prefix', () => {
      return request(app.getHttpServer()).get('/prefix-test').expect(404);
    });

    it.each(['/health', '/health/ready'])(
      'keeps %s unprefixed',
      async (path) => {
        await request(app.getHttpServer()).get(path).expect(200);
      },
    );

    it.each(['/api/health', '/api/health/ready'])(
      'does not serve %s',
      async (path) => {
        await request(app.getHttpServer()).get(path).expect(404);
      },
    );

    it('keeps the docs at /docs and documents prefixed paths', async () => {
      await request(app.getHttpServer()).get(`/${SWAGGER_PATH}`).expect(200);
      await request(app.getHttpServer())
        .get(`/api/${SWAGGER_PATH}`)
        .expect(404);

      const res = await request(app.getHttpServer())
        .get(`/${SWAGGER_JSON_PATH}`)
        .expect(200);
      const paths = Object.keys((res.body as { paths: object }).paths);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/api/prefix-test',
          '/health',
          '/health/ready',
        ]),
      );
    });
  });

  describe('helmet', () => {
    it('sets security headers and hides x-powered-by', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prefix-test')
        .expect(200);

      expect(res.headers).toMatchObject({
        'content-security-policy':
          expect.stringContaining("default-src 'self'"),
        'strict-transport-security': expect.any(String),
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'cross-origin-opener-policy': 'same-origin',
        'referrer-policy': 'no-referrer',
      });
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });

    it('sets the headers on the docs too', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${SWAGGER_PATH}`)
        .expect(200);

      expect(res.headers['content-security-policy']).toContain(
        "script-src 'self'",
      );
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });

    it('sets the headers on error responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/does-not-exist')
        .expect(404);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('CORS', () => {
    it('allows a configured origin with credentials and x-request-id exposed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prefix-test')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-expose-headers']).toBe('x-request-id');
      expect(res.headers.vary).toContain('Origin');
    });

    it('sends no CORS headers for another origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prefix-test')
        .set('Origin', DISALLOWED_ORIGIN)
        .expect(200);

      expect(res.headers).not.toHaveProperty('access-control-allow-origin');
      expect(res.headers).not.toHaveProperty(
        'access-control-allow-credentials',
      );
      expect(res.headers).not.toHaveProperty('access-control-expose-headers');
    });

    it('answers a preflight from a configured origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/prefix-test')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-request-id')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-headers']).toBe(
        'content-type,x-request-id',
      );
    });

    it('does not answer a preflight from another origin', async () => {
      // Not handled by CORS, so it falls through to routing: no OPTIONS route.
      const res = await request(app.getHttpServer())
        .options('/api/prefix-test')
        .set('Origin', DISALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .expect(404);

      expect(res.headers).not.toHaveProperty('access-control-allow-origin');
      expect(res.headers).not.toHaveProperty(
        'access-control-allow-credentials',
      );
      expect(res.headers).not.toHaveProperty('access-control-allow-methods');
    });

    it('sends no CORS headers without an Origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prefix-test')
        .expect(200);

      expect(res.headers).not.toHaveProperty('access-control-allow-origin');
      expect(res.headers).not.toHaveProperty(
        'access-control-allow-credentials',
      );
    });
  });
});
