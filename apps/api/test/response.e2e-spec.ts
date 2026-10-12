import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Query,
  StreamableFile,
} from '@nestjs/common';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './../src/app.module.js';
import { Public } from './../src/auth/auth.decorators.js';
import { configureApp } from './../src/config/app.config.js';
import {
  paginate,
  PaginationQueryDto,
} from './../src/common/pagination/index.js';

const TOTAL = 57;
const ALL_ITEMS = Array.from({ length: TOTAL }, (_, i) => ({ id: i + 1 }));

function pageOf<T>(items: T[], page: number, limit: number): T[] {
  return items.slice((page - 1) * limit, page * limit);
}

@Public()
@Controller('response-test')
class ResponseTestController {
  @Get('item')
  item() {
    return { id: 1, name: 'Ada' };
  }

  @Get('list')
  list() {
    return [{ id: 1 }, { id: 2 }];
  }

  @Get('paginated')
  paginated(@Query() query: PaginationQueryDto) {
    return paginate(pageOf(ALL_ITEMS, query.page, query.limit), TOTAL, query);
  }

  @Get('paginated-summary')
  paginatedSummary(@Query() query: PaginationQueryDto) {
    return paginate(pageOf(ALL_ITEMS, query.page, query.limit), TOTAL, query, {
      active: 40,
      inactive: 17,
    });
  }

  @Get('empty')
  empty(@Query() query: PaginationQueryDto) {
    return paginate([], 0, query);
  }

  @Delete('no-content')
  @HttpCode(204)
  noContent() {}

  @Get('nothing')
  nothing() {}

  @Get('file')
  file() {
    return new StreamableFile(Buffer.from('hello'));
  }
}

describe('Response envelope (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ResponseTestController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app);
  });

  it('wraps a single object in data', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/item')
      .expect(200)
      .expect({ data: { id: 1, name: 'Ada' } });
  });

  it('wraps an array in data', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/list')
      .expect(200)
      .expect({ data: [{ id: 1 }, { id: 2 }] });
  });

  it('paginates a middle page', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/paginated?page=2&limit=20')
      .expect(200)
      .expect({
        data: pageOf(ALL_ITEMS, 2, 20),
        pagination: {
          page: 2,
          limit: 20,
          total: 57,
          totalPages: 3,
          hasPrevious: true,
          hasNext: true,
        },
      });
  });

  it('includes the summary when present', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/paginated-summary?page=3&limit=20')
      .expect(200)
      .expect({
        data: pageOf(ALL_ITEMS, 3, 20),
        pagination: {
          page: 3,
          limit: 20,
          total: 57,
          totalPages: 3,
          hasPrevious: true,
          hasNext: false,
        },
        summary: { active: 40, inactive: 17 },
      });
  });

  it('omits the summary key when absent', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/response-test/paginated?page=1&limit=20')
      .expect(200);

    expect(res.body).not.toHaveProperty('summary');
  });

  it('handles zero results', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/empty')
      .expect(200)
      .expect({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasPrevious: false,
          hasNext: false,
        },
      });
  });

  it('returns empty data with real totals beyond the last page', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/paginated?page=5&limit=20')
      .expect(200)
      .expect({
        data: [],
        pagination: {
          page: 5,
          limit: 20,
          total: 57,
          totalPages: 3,
          hasPrevious: true,
          hasNext: false,
        },
      });
  });

  it('applies page 1 and limit 20 by default', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/paginated')
      .expect(200)
      .expect({
        data: pageOf(ALL_ITEMS, 1, 20),
        pagination: {
          page: 1,
          limit: 20,
          total: 57,
          totalPages: 3,
          hasPrevious: false,
          hasNext: true,
        },
      });
  });

  it('rejects a limit over 100', () => {
    return request(app.getHttpServer())
      .get('/api/response-test/paginated?limit=101')
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: [
          {
            path: 'limit',
            message: 'Too big: expected number to be <=100',
            code: 'too_big',
          },
        ],
      });
  });

  it('sends an empty body for a 204 handler', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/response-test/no-content')
      .expect(204);

    expect(res.text).toBe('');
  });

  it('does not wrap undefined from a 200 handler', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/response-test/nothing')
      .expect(200);

    expect(res.text).toBe('');
  });

  it('passes a StreamableFile through untouched', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/response-test/file')
      .buffer(true)
      .expect(200);

    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(Buffer.from(res.body as Buffer).toString()).toBe('hello');
  });

  afterEach(async () => {
    await app.close();
  });
});
