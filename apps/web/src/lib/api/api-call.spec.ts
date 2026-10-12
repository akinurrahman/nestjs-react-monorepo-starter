import { delay, http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { apiCall, apiCallEmpty, apiCallPaginated } from './api-call';
import { CLIENT_ERROR_CODES } from './api-error';

const pagination = {
  page: 2,
  limit: 20,
  total: 57,
  totalPages: 3,
  hasPrevious: true,
  hasNext: true,
};

function captureRequest(method: 'get' | 'post' | 'delete', path: string) {
  const seen: { request?: Request } = {};
  server.use(
    http[method](path, ({ request }) => {
      seen.request = request.clone();
      return HttpResponse.json({ data: null });
    }),
  );
  return seen;
}

describe('apiCall', () => {
  it('unwraps data', async () => {
    server.use(
      http.get('/api/users/1', () =>
        HttpResponse.json({ data: { id: 1, name: 'Ada' } }),
      ),
    );

    await expect(apiCall('/users/1')).resolves.toEqual({ id: 1, name: 'Ada' });
  });

  it('returns null when the api sends { data: null }', async () => {
    server.use(
      http.get('/api/nothing', () => HttpResponse.json({ data: null })),
    );

    await expect(apiCall('/nothing')).resolves.toBeNull();
  });

  it.each([
    ['a 204', 204],
    ['a 200 with an empty body', 200],
  ])('throws BAD_RESPONSE for %s', async (_, status) => {
    server.use(
      http.get('/api/empty', () => new HttpResponse(null, { status })),
    );

    await expect(apiCall('/empty')).rejects.toMatchObject({
      name: 'ApiError',
      status,
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });

  it.each([
    ['an object without data', { id: 1 }],
    ['an array', [1, 2]],
  ])('throws BAD_RESPONSE for %s', async (_, body) => {
    server.use(http.get('/api/odd', () => HttpResponse.json(body)));

    await expect(apiCall('/odd')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });

  it('throws BAD_RESPONSE for a non-JSON success body', async () => {
    server.use(http.get('/api/text', () => HttpResponse.text('hello')));

    await expect(apiCall('/text')).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });

  it('sends method, JSON body and headers', async () => {
    const seen = captureRequest('post', '/api/users');

    await apiCall('/users', {
      method: 'POST',
      body: { name: 'Ada' },
      headers: { 'X-Trace': 'abc' },
    });

    expect(seen.request?.headers.get('content-type')).toMatch(
      /^application\/json/,
    );
    expect(seen.request?.headers.get('x-trace')).toBe('abc');
    await expect(seen.request?.json()).resolves.toEqual({ name: 'Ada' });
  });

  it('sends no Content-Type without a body', async () => {
    const seen = captureRequest('get', '/api/users');

    await apiCall('/users');

    expect(seen.request?.headers.has('content-type')).toBe(false);
  });

  it('sends a body and params together', async () => {
    const seen = captureRequest('delete', '/api/users');

    await apiCall('/users', {
      method: 'DELETE',
      body: { ids: ['a', 'b'] },
      params: { notify: true },
    });

    expect(new URL(seen.request!.url).search).toBe('?notify=true');
    await expect(seen.request?.json()).resolves.toEqual({ ids: ['a', 'b'] });
  });

  describe('params', () => {
    async function searchFor(params: Parameters<typeof apiCall>[1]) {
      const seen = captureRequest('get', '/api/search');
      await apiCall('/search', params);
      return new URL(seen.request!.url).search;
    }

    it('repeats the key for arrays, the shape the api parses as an array', async () => {
      expect(
        await searchFor({ params: { status: ['active', 'archived'] } }),
      ).toBe('?status=active&status=archived');
    });

    it('drops undefined and null', async () => {
      expect(
        await searchFor({ params: { a: 1, b: undefined, c: null, d: 'x' } }),
      ).toBe('?a=1&d=x');
    });

    it('encodes reserved characters', async () => {
      expect(await searchFor({ params: { q: 'a&b=c d' } })).toBe(
        '?q=a%26b%3Dc+d',
      );
    });

    it('sends dates as ISO strings', async () => {
      expect(
        await searchFor({ params: { from: new Date('2026-10-10T00:00:00Z') } }),
      ).toBe('?from=2026-10-10T00:00:00.000Z');
    });
  });

  it('passes an aborted request through untouched', async () => {
    server.use(
      http.get('/api/slow', async () => {
        await delay('infinite');
        return HttpResponse.json({ data: 1 });
      }),
    );
    const controller = new AbortController();

    const pending = apiCall('/slow', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'CanceledError',
      code: 'ERR_CANCELED',
    });
  });
});

describe('apiCallEmpty', () => {
  it('resolves undefined for a 204', async () => {
    server.use(
      http.delete(
        '/api/users/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      apiCallEmpty('/users/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('resolves undefined for a 200 with an empty body', async () => {
    server.use(
      http.post('/api/ping', () => new HttpResponse(null, { status: 200 })),
    );

    await expect(
      apiCallEmpty('/ping', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('ignores the data of an envelope', async () => {
    server.use(
      http.post('/api/ping', () => HttpResponse.json({ data: { ok: true } })),
    );

    await expect(
      apiCallEmpty('/ping', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('throws BAD_RESPONSE for a body that is not an envelope', async () => {
    server.use(http.post('/api/ping', () => HttpResponse.text('hello')));

    await expect(
      apiCallEmpty('/ping', { method: 'POST' }),
    ).rejects.toMatchObject({ code: CLIENT_ERROR_CODES.BAD_RESPONSE });
  });
});

describe('apiCallPaginated', () => {
  it('returns data, pagination and summary', async () => {
    const body = {
      data: [{ id: 21 }, { id: 22 }],
      pagination,
      summary: { active: 40 },
    };
    server.use(http.get('/api/users', () => HttpResponse.json(body)));

    await expect(
      apiCallPaginated<{ id: number }, { active: number }>('/users'),
    ).resolves.toEqual(body);
  });

  it('works without a summary', async () => {
    const body = { data: [], pagination };
    server.use(http.get('/api/users', () => HttpResponse.json(body)));

    await expect(apiCallPaginated('/users')).resolves.toEqual(body);
  });

  it.each([
    ['a plain data envelope', { data: [{ id: 1 }] }],
    ['data that is not an array', { data: { id: 1 }, pagination }],
    ['incomplete pagination', { data: [], pagination: { page: 1, limit: 20 } }],
  ])('throws BAD_RESPONSE for %s', async (_, body) => {
    server.use(http.get('/api/users', () => HttpResponse.json(body)));

    await expect(apiCallPaginated('/users')).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    });
  });
});
