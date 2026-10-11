import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, data } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { AppRouteObject } from '@/systems/router';
import { renderApp } from '@/test/render-app';
import { APP_NAME } from './config';
import { RootErrorBoundary } from './route-errors';

function Throws(): never {
  throw new Error('kaboom');
}

const home: AppRouteObject = { index: true, element: <p>home page</p> };

const pages: AppRouteObject[] = [
  home,
  { path: 'throws', Component: Throws },
  {
    path: 'missing',
    loader: () => {
      throw data('No such record', { status: 404 });
    },
    element: <p>never shown</p>,
  },
  {
    path: 'stale',
    lazy: () =>
      Promise.reject(
        new TypeError(
          'Failed to fetch dynamically imported module: /assets/stale-page-abc123.js',
        ),
      ),
  },
];

// Errors a boundary catches are still reported to the console.
function silenceConsoleErrors() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

const shellLink = () => screen.getByRole('link', { name: APP_NAME });

describe('route errors', () => {
  beforeEach(silenceConsoleErrors);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('shows the 404 inside the layout for an unknown url', async () => {
    renderApp(pages, '/no/such/page');

    expect(
      await within(screen.getByRole('main')).findByText('Not found'),
    ).toBeInTheDocument();
    expect(shellLink()).toBeInTheDocument();
    expect(document.title).toBe(`Not found | ${APP_NAME}`);
  });

  it('shows a page error inside the layout, with the shell usable', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/throws');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This page could not be shown',
    );

    await user.click(shellLink());

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers Reload and Go home from a page error', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/throws');
    const alert = await screen.findByRole('alert');

    expect(
      within(alert).getByRole('button', { name: 'Reload' }),
    ).toBeInTheDocument();
    await user.click(within(alert).getByRole('link', { name: 'Go home' }));

    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('shows error details in dev', async () => {
    renderApp(pages, '/throws');

    expect(await screen.findByText(/kaboom/)).toBeInTheDocument();
  });

  it('hides error details outside dev', async () => {
    vi.stubEnv('DEV', false);
    renderApp(pages, '/throws');

    await screen.findByRole('alert');
    expect(screen.queryByText(/kaboom/)).toBeNull();
  });

  it('shows NotFoundState for a thrown 404', async () => {
    renderApp(pages, '/missing');

    expect(
      await screen.findByText(/This record does not exist/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(shellLink()).toBeInTheDocument();
  });

  it('asks for a reload when a lazy chunk fails to load', async () => {
    const { router } = renderApp(pages, '/');
    await screen.findByText('home page');

    await act(() => router.navigate('/stale'));

    expect(
      await screen.findByText('A new version is available'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(shellLink()).toBeInTheDocument();
  });
});

describe('RootErrorBoundary', () => {
  beforeEach(silenceConsoleErrors);
  afterEach(() => vi.restoreAllMocks());

  it('shows ErrorState for an error in the route it guards', async () => {
    const router = createMemoryRouter([
      { path: '/', Component: Throws, ErrorBoundary: RootErrorBoundary },
    ]);
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This page could not be shown',
    );
  });
});
