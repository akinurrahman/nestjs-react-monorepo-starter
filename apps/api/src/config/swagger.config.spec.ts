import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Query,
} from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { PaginationQueryDto } from '../common/pagination/index.js';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../common/swagger/index.js';
import { validateEnv } from './env.schema.js';
import {
  createSwaggerDocument,
  setupSwagger,
  SWAGGER_JSON_PATH,
} from './swagger.config.js';

class ItemDto extends createZodDto(
  z.object({
    id: z.number().int(),
    name: z.string(),
    status: z.enum(['active', 'archived']).default('active'),
  }),
) {}

class CreateItemDto extends createZodDto(
  z.strictObject({
    name: z.string().min(1),
    tags: z.array(z.string()).optional(),
  }),
) {}

class ItemSummaryDto extends createZodDto(
  z.object({ active: z.number().int(), archived: z.number().int() }),
) {}

@Controller('docs-test')
class DocsTestController {
  @Get('item')
  @ApiDataResponse(ItemDto)
  item() {}

  @Get('items')
  @ApiDataResponse([ItemDto])
  items() {}

  @Get('paginated')
  @ApiPaginatedResponse(ItemDto, ItemSummaryDto)
  paginated(@Query() _query: PaginationQueryDto) {}

  @Post('items')
  @ApiDataResponse(ItemDto, { status: 201 })
  @ApiErrorResponses(400, 404, 409)
  create(@Body() _body: CreateItemDto) {}
}

const ITEM_REF = '#/components/schemas/ItemDto_Output';

// AppModule validates env when it is imported, so each app gets a fresh module
// graph after the env is stubbed. PrismaService is replaced: no database.
async function createApp(
  env: Record<string, string | undefined> = {},
): Promise<INestApplication<App>> {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/unused');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-0123456789abcdef');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

  const { AppModule } = await import('../app.module.js');
  const { PrismaService } = await import('../database/prisma.service.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [DocsTestController],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  return moduleRef.createNestApplication();
}

function responseSchema(
  doc: OpenAPIObject,
  method: 'get' | 'post',
  path: string,
  status: string,
) {
  const response = doc.paths[path]?.[method]?.responses[status];
  if (!response || !('content' in response)) return undefined;
  return response.content?.['application/json']?.schema;
}

describe('OpenAPI document', () => {
  let app: INestApplication<App>;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    doc = createSwaggerDocument(app);
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('wraps a single model in a required data property', () => {
    expect(responseSchema(doc, 'get', '/docs-test/item', '200')).toEqual({
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: ITEM_REF } },
    });
  });

  it('wraps a list in a required data array', () => {
    expect(responseSchema(doc, 'get', '/docs-test/items', '200')).toEqual({
      type: 'object',
      required: ['data'],
      properties: { data: { type: 'array', items: { $ref: ITEM_REF } } },
    });
  });

  it('describes the paginated envelope with an optional summary', () => {
    expect(responseSchema(doc, 'get', '/docs-test/paginated', '200')).toEqual({
      type: 'object',
      required: ['data', 'pagination'],
      properties: {
        data: { type: 'array', items: { $ref: ITEM_REF } },
        pagination: { $ref: '#/components/schemas/PaginationMetaDto' },
        summary: { $ref: '#/components/schemas/ItemSummaryDto_Output' },
      },
    });

    expect(doc.components?.schemas?.PaginationMetaDto).toMatchObject({
      type: 'object',
      required: [
        'page',
        'limit',
        'total',
        'totalPages',
        'hasPrevious',
        'hasNext',
      ],
    });
  });

  it('documents the output schema of response models', () => {
    // `status` has a default, so it is optional on input but always present
    // in what the client receives.
    expect(doc.components?.schemas?.ItemDto_Output).toMatchObject({
      type: 'object',
      required: ['id', 'name', 'status'],
    });
  });

  it('points each given error status at the error schema', () => {
    for (const status of ['400', '404', '409']) {
      expect(responseSchema(doc, 'post', '/docs-test/items', status)).toEqual({
        $ref: '#/components/schemas/ErrorResponseDto',
      });
    }
    expect(doc.components?.schemas?.ErrorResponseDto).toMatchObject({
      type: 'object',
      required: ['statusCode', 'code', 'message'],
      properties: {
        errors: {
          type: 'array',
          items: { required: ['path', 'message', 'code'] },
        },
      },
    });
  });

  it('documents a createZodDto request body', () => {
    const operation = doc.paths['/docs-test/items']?.post;
    expect(operation?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateItemDto' },
        },
      },
    });
    expect(doc.components?.schemas?.CreateItemDto).toMatchObject({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1 },
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  it('documents a createZodDto query as parameters', () => {
    const names = doc.paths['/docs-test/paginated']?.get?.parameters?.map(
      (param) => ('name' in param ? param.name : undefined),
    );
    expect(names).toEqual(expect.arrayContaining(['page', 'limit']));
  });

  it('strips the nestjs-zod markers that cleanupOpenApiDoc removes', () => {
    const raw = SwaggerModule.createDocument(app, {
      openapi: '3.0.0',
      info: { title: 'raw', version: '0' },
    });
    expect(JSON.stringify(raw)).toContain('x-nestjs_zod');
    expect(JSON.stringify(doc)).not.toContain('x-nestjs_zod');
  });
});

describe('setupSwagger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the JSON document when enabled', async () => {
    const app = await createApp({ SWAGGER_ENABLED: 'true' });
    expect(setupSwagger(app)).toBe(true);
    await app.init();

    await request(app.getHttpServer()).get(`/${SWAGGER_JSON_PATH}`).expect(200);
    await app.close();
  });

  it('is skipped when SWAGGER_ENABLED is false', async () => {
    const app = await createApp({ SWAGGER_ENABLED: 'false' });
    expect(setupSwagger(app)).toBe(false);
    await app.init();

    await request(app.getHttpServer()).get(`/${SWAGGER_JSON_PATH}`).expect(404);
    await app.close();
  });
});

describe('SWAGGER_ENABLED', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost:5432/unused',
    JWT_SECRET: 'unit-test-jwt-secret-0123456789abcdef',
  };

  it('defaults to true outside production', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'development' })).toMatchObject({
      SWAGGER_ENABLED: true,
    });
  });

  it('defaults to false in production', () => {
    expect(
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example.com',
      }),
    ).toMatchObject({
      SWAGGER_ENABLED: false,
    });
  });

  it('parses "false" as false', () => {
    expect(
      validateEnv({
        ...base,
        NODE_ENV: 'development',
        SWAGGER_ENABLED: 'false',
      }),
    ).toMatchObject({ SWAGGER_ENABLED: false });
  });
});
