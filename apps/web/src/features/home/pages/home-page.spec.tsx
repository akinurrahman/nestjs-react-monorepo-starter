import { ERROR_CODES, type ErrorResponse } from '@starter/shared';
import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithQuery } from '@/test/render-with-query';
import HomePage from './home-page';

const STATUS_PATH = '/api/health/status';

const databaseDown = {
  statusCode: 503,
  code: ERROR_CODES.SERVICE_UNAVAILABLE,
  message: 'Service unavailable',
} satisfies ErrorResponse;

function serveStatus(resolver: () => Response | Promise<Response>) {
  const count = { value: 0 };
  server.use(
    http.get(STATUS_PATH, () => {
      count.value += 1;
      return resolver();
    }),
  );
  return count;
}

describe('HomePage API status', () => {
  it('shows a skeleton while the status loads', async () => {
    serveStatus(async () => {
      await delay('infinite');
      return HttpResponse.json({});
    });
    renderWithQuery(<HomePage />);

    expect(
      await screen.findByRole('status', { name: 'Checking API status' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('API up')).not.toBeInTheDocument();
  });

  it('shows the API as up when readiness answers ok', async () => {
    serveStatus(() =>
      HttpResponse.json({
        data: { status: 'ok', checks: { database: 'ok' } },
      }),
    );
    renderWithQuery(<HomePage />);

    expect(await screen.findByText('API up')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Checking API status' }),
    ).not.toBeInTheDocument();
  });

  it('shows the API as unreachable after one failed request, without retrying', async () => {
    const count = serveStatus(() => HttpResponse.error());
    renderWithQuery(<HomePage />);

    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(count.value).toBe(1);
  });

  it('shows the database as unavailable on a 503 SERVICE_UNAVAILABLE', async () => {
    const count = serveStatus(() =>
      HttpResponse.json(databaseDown, { status: 503 }),
    );
    renderWithQuery(<HomePage />);

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(count.value).toBe(1);
  });
});
