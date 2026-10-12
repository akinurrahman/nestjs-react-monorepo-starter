import { Controller, Get, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { queryArray } from '@starter/shared';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from './../src/app.module.js';
import { Public } from './../src/auth/auth.decorators.js';
import { ApiErrorResponses } from './../src/common/swagger/index.js';
import { configureApp } from './../src/config/app.config.js';
import { createSwaggerDocument } from './../src/config/swagger.config.js';

class StatusFilterDto extends createZodDto(
  z.object({
    status: queryArray(z.enum(['active', 'archived'])).optional(),
  }),
) {}

@Public()
@Controller('query-array-test')
class QueryArrayTestController {
  @Get()
  @ApiErrorResponses(400)
  list(@Query() query: StatusFilterDto) {
    return query;
  }
}

describe('Array query params (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [QueryArrayTestController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a single value as a one-item array', () => {
    return request(app.getHttpServer())
      .get('/api/query-array-test?status=active')
      .expect(200)
      .expect({ data: { status: ['active'] } });
  });

  it('accepts repeated values', () => {
    return request(app.getHttpServer())
      .get('/api/query-array-test?status=active&status=archived')
      .expect(200)
      .expect({ data: { status: ['active', 'archived'] } });
  });

  it('leaves a missing param out', () => {
    return request(app.getHttpServer())
      .get('/api/query-array-test')
      .expect(200)
      .expect({ data: {} });
  });

  it('rejects an invalid item', () => {
    return request(app.getHttpServer())
      .get('/api/query-array-test?status=active&status=deleted')
      .expect(400)
      .expect((res) => {
        expect(res.body).toMatchObject({
          code: 'VALIDATION_FAILED',
          errors: [{ path: 'status.1', code: 'invalid_value' }],
        });
      });
  });

  // ?status= parses to an empty string, which becomes [''], not [].
  it('rejects an empty value as an invalid item', () => {
    return request(app.getHttpServer())
      .get('/api/query-array-test?status=')
      .expect(400)
      .expect((res) => {
        expect(res.body).toMatchObject({
          code: 'VALIDATION_FAILED',
          errors: [{ path: 'status.0', code: 'invalid_value' }],
        });
      });
  });

  it('documents the param as an array of the item type', async () => {
    await app.init();
    const doc = createSwaggerDocument(app);
    const params = doc.paths['/api/query-array-test']?.get?.parameters;

    expect(params).toEqual([
      expect.objectContaining({
        name: 'status',
        in: 'query',
        required: false,
        schema: {
          type: 'array',
          items: { type: 'string', enum: ['active', 'archived'] },
        },
      }),
    ]);
  });
});
