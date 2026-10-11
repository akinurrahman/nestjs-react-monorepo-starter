import { act, screen } from '@testing-library/react';
import type { RouteObject } from 'react-router';
import { renderApp } from '@/test/render-app';
import { APP_NAME } from '../config';
import { createAppRouter } from '../router';
import { devRoutes, SLOW_ROUTE_DELAY_MS } from './dev-routes';

function pathsIn(routes: readonly RouteObject[]): string[] {
  return routes.flatMap((route) => [
    ...(route.path ? [route.path] : []),
    ...pathsIn(route.children ?? []),
  ]);
}

// The router the app really starts with, not a test tree.
function devPaths() {
  const router = createAppRouter();
  const paths = pathsIn(router.routes).filter((path) =>
    path.startsWith('dev/'),
  );
  router.dispose();
  return paths;
}

const shellLink = () => screen.getByRole('link', { name: APP_NAME });

describe('dev routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('are in the app in dev', () => {
    expect(devPaths()).toEqual(devRoutes.map((route) => route.path));
  });

  it('are left out when DEV is false', () => {
    vi.stubEnv('DEV', false);

    expect(devPaths()).toEqual([]);
  });

  it('/dev/throws shows the page error inside the layout', async () => {
    // Errors a boundary catches are still reported to the console.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(devRoutes, '/dev/throws');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This page could not be shown',
    );
    expect(shellLink()).toBeInTheDocument();
  });

  it('/dev/chunk-error asks for a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(devRoutes, '/dev/chunk-error');

    expect(
      await screen.findByText('A new version is available'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(shellLink()).toBeInTheDocument();
  });

  it('/dev/slow shows the progress bar until its chunk lands', async () => {
    // Loaded up front, so only the route's own delay holds the page back.
    await import('./dev-fault-pages');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { router } = renderApp(devRoutes, '/dev/missing');
    await screen.findByText(/This page does not exist/);

    act(() => {
      void router.navigate('/dev/slow');
    });

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();

    // Half way, since shouldAdvanceTime also moves the clock in real time.
    await act(() => vi.advanceTimersByTimeAsync(SLOW_ROUTE_DELAY_MS / 2));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Slow page' })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(SLOW_ROUTE_DELAY_MS / 2));

    expect(
      await screen.findByRole('heading', { name: 'Slow page' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
