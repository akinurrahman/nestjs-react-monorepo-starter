import { Writable } from 'node:stream';
import { type ArgumentsHost, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { createHttpLogger } from '../../config/logger.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ConflictError, ServiceUnavailableError } from '../errors/index.js';
import { reportError } from '../reporting/report-error.js';
import {
  AllExceptionsFilter,
  toErrorResponse,
} from './all-exceptions.filter.js';

vi.mock('../reporting/report-error.js', () => ({ reportError: vi.fn() }));

const INTERNAL_ERROR = {
  statusCode: 500,
  code: 'INTERNAL_ERROR',
  message: 'Internal server error',
};

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('internal prisma detail', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['email'] },
  });
}

describe('toErrorResponse (Prisma)', () => {
  it('maps P2002 to 409 CONFLICT', () => {
    expect(toErrorResponse(prismaError('P2002'))).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Resource already exists',
    });
  });

  it('maps P2025 to 404 NOT_FOUND', () => {
    expect(toErrorResponse(prismaError('P2025'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });

  // The shape Prisma 7 with the pg adapter throws for a NUL byte in text.
  function postgresError(originalCode: string) {
    return new Prisma.PrismaClientKnownRequestError('internal prisma detail', {
      code: 'P2039',
      clientVersion: Prisma.prismaVersion.client,
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: { originalCode, kind: 'postgres' },
        },
      },
    });
  }

  it('maps Postgres 22021 (NUL byte) to 400 BAD_REQUEST', () => {
    expect(toErrorResponse(postgresError('22021'))).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Request contains a character that is not allowed',
    });
  });

  it('keeps other Postgres errors at 500', () => {
    expect(toErrorResponse(postgresError('22P02'))).toEqual(INTERNAL_ERROR);
  });

  it('maps other known codes to 500 INTERNAL_ERROR', () => {
    expect(toErrorResponse(prismaError('P2003'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});

describe('toErrorResponse (AppError)', () => {
  it('sends field errors but never the cause', () => {
    const errors = [
      {
        path: 'email',
        message: 'Email is already in use',
        code: 'EMAIL_TAKEN',
      },
    ];
    const error = new ConflictError('EMAIL_TAKEN', 'Email is already in use', {
      errors,
      cause: new Error('internal detail'),
    });

    const body = toErrorResponse(error);

    expect(body).toEqual({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email is already in use',
      errors,
    });
    expect(JSON.stringify(body)).not.toContain('internal detail');
    expect(error.cause).toBeInstanceOf(Error);
  });
});

describe('toErrorResponse (ThrottlerException)', () => {
  it('maps to 429 TOO_MANY_REQUESTS without the library message', () => {
    expect(toErrorResponse(new ThrottlerException())).toEqual({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, try again later',
    });
  });
});

describe('AllExceptionsFilter (ServiceUnavailableError)', () => {
  const SERVICE_UNAVAILABLE = {
    statusCode: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes 503 through instead of INTERNAL_ERROR, without the cause', () => {
    const error = new ServiceUnavailableError(undefined, undefined, {
      cause: new Error('connect ECONNREFUSED'),
    });

    const body = toErrorResponse(error);

    expect(body).toEqual(SERVICE_UNAVAILABLE);
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('logs the error with its cause attached', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const { host, status, json } = httpHost({});
    const cause = new Error('connect ECONNREFUSED');
    const error = new ServiceUnavailableError(undefined, undefined, { cause });

    new AllExceptionsFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(SERVICE_UNAVAILABLE);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      { err: error },
      'Service unavailable',
    );
    expect(error.cause).toBe(cause);
  });
});

describe('toErrorResponse (http-errors from Express middleware)', () => {
  function httpError(status: number, expose: boolean) {
    return Object.assign(new Error('library detail: limit is 102400'), {
      status,
      statusCode: status,
      expose,
    });
  }

  it.each([
    [413, 'PAYLOAD_TOO_LARGE', 'Payload too large'],
    [415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type'],
    [400, 'BAD_REQUEST', 'Bad request'],
  ])('maps an exposed %i to %s', (status, code, message) => {
    expect(toErrorResponse(httpError(status, true))).toEqual({
      statusCode: status,
      code,
      message,
    });
  });

  it('keeps an unexposed client error internal', () => {
    expect(toErrorResponse(httpError(413, false))).toEqual(INTERNAL_ERROR);
  });

  it('keeps a 5xx internal even when exposed', () => {
    expect(toErrorResponse(httpError(502, true))).toEqual(INTERNAL_ERROR);
  });
});

describe('AllExceptionsFilter (logging)', () => {
  it('logs to req.log without query data or the raw message', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const log = createHttpLogger(
      { NODE_ENV: 'test', LOG_LEVEL: 'info' },
      stream,
    ).logger;
    const error = new Prisma.PrismaClientValidationError(
      'Invalid `prisma.user.create()` invocation: { email: "ada@example.com" }',
      { clientVersion: Prisma.prismaVersion.client },
    );

    new AllExceptionsFilter().catch(error, httpHost({ log }).host);

    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]) as Record<string, any>;
    expect(line).toMatchObject({
      level: 50,
      context: 'AllExceptionsFilter',
      msg: 'Internal server error',
      err: { type: 'PrismaClientValidationError' },
    });
    expect(lines[0]).not.toContain('ada@example.com');
  });
});

describe('AllExceptionsFilter (reporting)', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an unexpected error once, with the request context only', () => {
    const error = new Error('boom');
    const request = {
      id: 'req-1',
      method: 'GET',
      route: { path: '/api/users/:id' },
      body: { password: 'secret' },
    };

    new AllExceptionsFilter().catch(error, httpHost(request).host);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, {
      requestId: 'req-1',
      method: 'GET',
      route: '/api/users/:id',
    });
  });

  it('does not report a client error', () => {
    new AllExceptionsFilter().catch(new ConflictError(), httpHost({}).host);

    expect(reportError).not.toHaveBeenCalled();
  });
});

function httpHost(request: object) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}
