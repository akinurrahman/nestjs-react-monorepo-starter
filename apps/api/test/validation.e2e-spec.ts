import { Body, Controller, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { z } from 'zod';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Public } from './../src/auth/auth.decorators.js';
import { createApp } from './auth-helpers.js';

class CreateThingDto extends createZodDto(
  z.strictObject({
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
    ({ app } = await createApp({ controllers: [ValidationTestController] }));
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

  it('rejects unknown fields in the body', () => {
    return request(app.getHttpServer())
      .post('/api/validation-test')
      .send({ name: 'Ada', email: 'ada@example.com', isAdmin: true })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: [
          {
            path: '',
            message: 'Unrecognized key: "isAdmin"',
            code: 'unrecognized_keys',
          },
        ],
      });
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
