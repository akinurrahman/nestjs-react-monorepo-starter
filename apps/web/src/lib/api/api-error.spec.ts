import { isCancel } from 'axios';
import { delay, http, HttpResponse } from 'msw';
import {
  conflict,
  internalError,
  notFound,
  payloadTooLarge,
  tooManyRequests,
  userNotFound,
  validationFailed,
} from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { apiCall } from './api-call';
import {
  ApiError,
  CLIENT_ERROR_CODES,
  getErrorMessage,
  isApiError,
} from './api-error';

const NETWORK_MESSAGE =
  'Could not reach the server. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

async function failure(respond: () => Response | Promise<Response>) {
  server.use(http.get('/api/thing', respond));
  try {
    await apiCall('/thing');
  } catch (error) {
    return error;
  }
  throw new Error('Expected the request to fail');
}

describe('ApiError from a response', () => {
  it.each([
    ['404', notFound],
    ['a domain 404 code', userNotFound],
    ['409', conflict],
    ['413', payloadTooLarge],
    ['429', tooManyRequests],
    ['500', internalError],
  ])('uses the server body for %s', async (_, body) => {
    const error = await failure(() =>
      HttpResponse.json(body, { status: body.statusCode }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: body.statusCode,
      code: body.code,
      message: body.message,
      fieldErrors: [],
    });
  });

  it('carries field errors for a validation failure', async () => {
    const error = await failure(() =>
      HttpResponse.json(validationFailed, { status: 400 }),
    );

    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      fieldErrors: validationFailed.errors,
    });
  });

  it('keeps the axios error as the cause', async () => {
    const error = await failure(() =>
      HttpResponse.json(notFound, { status: 404 }),
    );

    expect((error as ApiError).cause).toMatchObject({ isAxiosError: true });
  });

  it('is BAD_RESPONSE for an HTML 502', async () => {
    const error = await failure(
      () =>
        new HttpResponse('<html><body>Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
    );

    expect(error).toMatchObject({
      status: 502,
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
      message: 'Unexpected response from the server',
    });
  });

  it('is BAD_RESPONSE for an empty error body', async () => {
    const error = await failure(() => new HttpResponse(null, { status: 503 }));

    expect(error).toMatchObject({
      status: 503,
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });

  it('is BAD_RESPONSE for JSON that is not an error body', async () => {
    const error = await failure(() =>
      HttpResponse.json({ error: 'nope' }, { status: 400 }),
    );

    expect(error).toMatchObject({
      status: 400,
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });
});

describe('ApiError retryAfter', () => {
  const tooMany = (headers?: Record<string, string>) =>
    failure(() => HttpResponse.json(tooManyRequests, { status: 429, headers }));

  afterEach(() => vi.useRealTimers());

  it('reads delta seconds from Retry-After', async () => {
    expect(await tooMany({ 'Retry-After': '42' })).toMatchObject({
      retryAfter: 42,
    });
  });

  it('reads an HTTP date from Retry-After, rounding up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00.500Z'));

    expect(
      await tooMany({ 'Retry-After': 'Sat, 17 Oct 2026 12:01:30 GMT' }),
    ).toMatchObject({ retryAfter: 90 });
  });

  it.each([
    ['no header', undefined],
    ['a value that is not a number or date', { 'Retry-After': 'soon' }],
    ['zero', { 'Retry-After': '0' }],
    ['a date in the past', { 'Retry-After': 'Thu, 01 Jan 2015 00:00:00 GMT' }],
  ])('is undefined for %s', async (_, headers) => {
    expect((await tooMany(headers)) as ApiError).toHaveProperty(
      'retryAfter',
      undefined,
    );
  });
});

describe('ApiError without a response', () => {
  it('is NETWORK_ERROR with status 0', async () => {
    const error = await failure(() => HttpResponse.error());

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0,
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('leaves a cancelled request as the axios cancel error', async () => {
    server.use(
      http.get('/api/slow', async () => {
        await delay('infinite');
        return HttpResponse.json({ data: 1 });
      }),
    );
    const controller = new AbortController();
    const pending = apiCall('/slow', { signal: controller.signal });
    controller.abort();

    const error = await pending.catch((e: unknown) => e);

    expect(isCancel(error)).toBe(true);
    expect(isApiError(error)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it.each([
    ['validation', validationFailed, 'Validation failed'],
    ['404', notFound, 'Resource not found'],
    ['409', conflict, 'Resource already exists'],
    ['429', tooManyRequests, 'Too many requests, try again later'],
    ['500', internalError, SERVER_MESSAGE],
  ])('for a %s response', async (_, body, expected) => {
    const error = await failure(() =>
      HttpResponse.json(body, { status: body.statusCode }),
    );

    expect(getErrorMessage(error)).toBe(expected);
  });

  it.each([
    [1, '1 second'],
    [42, '42 seconds'],
    [59, '59 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [600, '10 minutes'],
  ])('says how long to wait for a 429 with retryAfter %i', (seconds, wait) => {
    const error = new ApiError({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, try again later',
      retryAfter: seconds,
    });

    expect(getErrorMessage(error)).toBe(
      `Too many requests. Try again in ${wait}.`,
    );
  });

  it('hides the message of a 5xx even when the server sends one', () => {
    const error = new ApiError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database exploded',
    });

    expect(getErrorMessage(error)).toBe(SERVER_MESSAGE);
  });

  // In production a reverse proxy answers 502 while the api is down.
  describe.each([502, 503, 504])('for a %i', (status) => {
    it.each([
      [
        'an HTML body',
        () =>
          new HttpResponse('<html></html>', {
            status,
            headers: { 'Content-Type': 'text/html' },
          }),
      ],
      ['an empty body', () => new HttpResponse(null, { status })],
      [
        "the api's own error body",
        () =>
          HttpResponse.json(
            {
              statusCode: status,
              code: 'SERVICE_UNAVAILABLE',
              message: 'Database unreachable',
            },
            { status },
          ),
      ],
    ])('with %s says the server is unreachable', async (_, respond) => {
      const error = await failure(respond);

      expect(getErrorMessage(error)).toBe(NETWORK_MESSAGE);
    });
  });

  it('for a 4xx that is not an error body', async () => {
    const error = await failure(
      () => new HttpResponse('<html></html>', { status: 404 }),
    );

    expect(getErrorMessage(error)).toBe(SERVER_MESSAGE);
  });

  it('for a network failure', async () => {
    const error = await failure(() => HttpResponse.error());

    expect(getErrorMessage(error)).toBe(NETWORK_MESSAGE);
  });

  it.each([
    ['a plain Error', new Error('secret internals')],
    ['a string', 'boom'],
    ['undefined', undefined],
  ])('for %s', (_, error) => {
    expect(getErrorMessage(error)).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
