import { Writable } from 'node:stream';
import { pino, type Logger } from 'pino';
import { ServiceUnavailableError } from '../common/errors/index.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  createHttpLogger,
  createPinoHttpOptions,
  createPinoOptions,
} from './logger.config.js';

const ENV = { NODE_ENV: 'test', LOG_LEVEL: 'info' } as const;

// What a failed `prisma.user.create()` with a bad `name` prints.
const VALIDATION_MESSAGE = `
Invalid \`prisma.user.create()\` invocation:

{
  data: {
    email: "ada@example.com",
    passwordHash: "HASH-SECRET",
    name: 123
  }
}

Argument \`name\`: Invalid value provided. Expected String, provided Int.`;

const USER_DATA = /ada@example\.com|HASH-SECRET|user-input-value/;

function validationError() {
  return new Prisma.PrismaClientValidationError(VALIDATION_MESSAGE, {
    clientVersion: Prisma.prismaVersion.client,
  });
}

// A raw query error: the database's message quotes the input value.
function rawQueryError() {
  const message = 'invalid input syntax for type integer: "user-input-value"';
  return new Prisma.PrismaClientKnownRequestError(
    `Raw query failed. Code: \`22P02\`. Message: \`${message}\``,
    {
      code: 'P2010',
      clientVersion: Prisma.prismaVersion.client,
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '22P02',
            originalMessage: message,
            kind: 'InvalidInputValue',
            message,
          },
        },
      },
    },
  );
}

const loggers: Record<string, (stream: Writable) => Logger> = {
  'the base logger': (stream) => pino(createPinoOptions(ENV), stream),
  // Its serializers are wrapped by pino-http; req.log is a child of it.
  'the request logger': (stream) => createHttpLogger(ENV, stream).logger,
};

function logged(createLogger: (stream: Writable) => Logger, err: unknown) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  createLogger(stream).error({ err }, 'Internal server error');
  expect(lines).toHaveLength(1);
  return {
    text: lines[0],
    err: (JSON.parse(lines[0]) as { err: Record<string, any> }).err,
  };
}

describe.each(Object.keys(loggers))('Prisma errors through %s', (name) => {
  const createLogger = loggers[name];

  it('logs a validation error without the query arguments', () => {
    const { text, err } = logged(createLogger, validationError());

    expect(text).not.toMatch(USER_DATA);
    expect(err.type).toBe('PrismaClientValidationError');
    expect(err.message).toContain('message not logged');
    expect(err.stack).toMatch(/\n {4}at /);
  });

  it('logs a raw query error with its code and names only', () => {
    const { text, err } = logged(createLogger, rawQueryError());

    expect(text).not.toMatch(USER_DATA);
    expect(err).toEqual({
      type: 'PrismaClientKnownRequestError',
      code: 'P2010',
      message:
        'P2010 [model User, database 22P02, kind InvalidInputValue] (message not logged: it can contain query data)',
      stack: expect.stringMatching(
        /^PrismaClientKnownRequestError: P2010 \[.*\n {4}at /,
      ),
    });
  });

  it('scrubs a Prisma error used as a cause and keeps the outer error', () => {
    const outer = new ServiceUnavailableError(undefined, undefined, {
      cause: validationError(),
    });

    const { text, err } = logged(createLogger, outer);

    expect(text).not.toMatch(USER_DATA);
    expect(err).toMatchObject({
      type: 'ServiceUnavailableError',
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      cause: {
        type: 'PrismaClientValidationError',
        message: expect.stringContaining('message not logged'),
      },
    });
  });

  it('leaves other messages and causes as they are', () => {
    const outer = new ServiceUnavailableError(undefined, undefined, {
      cause: new Error('Timed out after 2000ms'),
    });

    const { err } = logged(createLogger, outer);

    expect(err).toMatchObject({
      message: 'Service unavailable',
      cause: { type: 'Error', message: 'Timed out after 2000ms' },
    });
  });

  // What an HTTP client error looks like: the request it sent, with its
  // headers and body, hangs off the error and its cause.
  it('keeps only type, message, stack, code and cause, at any depth', () => {
    const secrets = {
      config: {
        headers: { Authorization: 'Bearer SECRET-TOKEN' },
        data: { password: 'SECRET-PASSWORD' },
      },
      body: { user: { password: 'SECRET-PASSWORD' } },
      response: { data: { token: 'SECRET-TOKEN' } },
    };
    const cause = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
      ...secrets,
    });
    const outer = Object.assign(
      new Error('Request failed', { cause }),
      secrets,
    );

    const { text, err } = logged(createLogger, outer);

    expect(text).not.toMatch(/SECRET-/);
    expect(Object.keys(err).sort()).toEqual(
      ['cause', 'message', 'stack', 'type'].sort(),
    );
    expect(Object.keys(err.cause as object).sort()).toEqual(
      ['code', 'message', 'stack', 'type'].sort(),
    );
    expect(err.cause).toMatchObject({
      type: 'Error',
      message: 'socket hang up',
      code: 'ECONNRESET',
    });
  });

  it('survives a cause cycle', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    a.cause = b;

    const { err } = logged(createLogger, a);

    expect(err).toMatchObject({
      message: 'a',
      cause: { message: 'b', cause: { message: '[Circular]' } },
    });
  });
});

describe('error serializer in development', () => {
  // A logger can't be built here: development adds the pretty transport,
  // which takes no destination stream. Both serializers are checked instead.
  const DEV = { NODE_ENV: 'development', LOG_LEVEL: 'info' } as const;

  it.each([
    ['base', () => createPinoOptions(DEV).serializers?.err],
    ['request', () => createPinoHttpOptions(DEV).serializers?.err],
  ])('keeps the full Prisma message in the %s serializer', (_, serializer) => {
    const serialized = serializer()?.(validationError()) as { message: string };

    expect(serialized.message).toBe(VALIDATION_MESSAGE);
  });
});

describe('error serializer', () => {
  it('does not modify the error being logged', () => {
    const cause = validationError();
    const outer = new ServiceUnavailableError(undefined, undefined, { cause });

    logged(loggers['the base logger'], outer);

    expect(outer.cause).toBe(cause);
    expect(cause.message).toBe(VALIDATION_MESSAGE);
  });
});
