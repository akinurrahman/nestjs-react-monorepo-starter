import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './../src/app.module.js';
import { Public } from './../src/auth/auth.decorators.js';
import { configureApp } from './../src/config/app.config.js';

class CreateThingDto extends createZodDto(
  z.object({
    name: z.string().min(2),
    email: z.email(),
  }),
) {}

@Public()
@Controller('validation-test')
class ValidationTestController {
  @Post()
  create(@Body() body: CreateThingDto) {
    return body;
  }
}

describe('Global validation (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationTestController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app);
  });

  it('accepts valid input', () => {
    return request(app.getHttpServer())
      .post('/api/validation-test')
      .send({ name: 'Ada', email: 'ada@example.com' })
      .expect(201)
      .expect({ data: { name: 'Ada', email: 'ada@example.com' } });
  });

  it('rejects invalid input with the failing fields', () => {
    return request(app.getHttpServer())
      .post('/api/validation-test')
      .send({ name: 'A', email: 'not-an-email' })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: [
          {
            path: 'name',
            message: 'Too small: expected string to have >=2 characters',
            code: 'too_small',
          },
          {
            path: 'email',
            message: 'Invalid email address',
            code: 'invalid_format',
          },
        ],
      });
  });

  it('strips unknown fields from the body', () => {
    return request(app.getHttpServer())
      .post('/api/validation-test')
      .send({ name: 'Ada', email: 'ada@example.com', isAdmin: true })
      .expect(201)
      .expect({ data: { name: 'Ada', email: 'ada@example.com' } });
  });

  afterEach(async () => {
    await app.close();
  });
});
