import { act, screen, waitFor } from '@testing-library/react';
import { Box, FileText, Folder } from 'lucide-react';
import { matchRoutes } from 'react-router';
import { homeRoutes } from '@/features/home';
import { readRouteHandle, type AppRouteObject } from '@/systems/router';
import { renderApp } from '@/test/render-app';
import { APP_NAME } from './config';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function LazyPage() {
  return <p>lazy page</p>;
}

const home: AppRouteObject = { index: true, element: <p>home page</p> };

function lazyRoute(load: () => Promise<typeof LazyPage>): AppRouteObject {
  return {
    path: 'lazy',
    handle: { title: 'Lazy page', icon: Box },
    lazy: async () => ({ Component: await load() }),
  };
}

describe('document title', () => {
  const pages: AppRouteObject[] = [
    home,
    {
      path: 'parent',
      handle: { title: 'Parent', icon: Folder },
      children: [
        {
          path: 'child',
          handle: { title: 'Child', icon: FileText },
          element: <p>child page</p>,
        },
        { path: 'untitled', element: <p>untitled page</p> },
      ],
    },
  ];

  it('uses the deepest match with a title', async () => {
    renderApp(pages, '/parent/child');

    await screen.findByText('child page');
    expect(document.title).toBe(`Child | ${APP_NAME}`);
  });

  it('updates on navigation', async () => {
    const { router } = renderApp(pages, '/parent/child');
    await screen.findByText('child page');

    await act(() => router.navigate('/parent/untitled'));

    await screen.findByText('untitled page');
    expect(document.title).toBe(`Parent | ${APP_NAME}`);
  });

  it('falls back to the app name without a title', async () => {
    renderApp(pages, '/');

    await screen.findByText('home page');
    expect(document.title).toBe(APP_NAME);
  });
});

describe('lazy routes', () => {
  it('renders the home feature at /', async () => {
    renderApp(homeRoutes, '/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Home' }),
    ).toBeInTheDocument();
    expect(document.title).toBe(`Home | ${APP_NAME}`);
  });

  it('has a readable handle before its chunk loads', () => {
    const load = vi.fn(() => Promise.resolve(LazyPage));
    const { router } = renderApp([home, lazyRoute(load)], '/');

    const match = matchRoutes(router.routes, '/lazy')?.at(-1);

    expect(readRouteHandle(match?.route.handle)?.title).toBe('Lazy page');
    expect(load).not.toHaveBeenCalled();
  });

  it('cannot get its handle from lazy', () => {
    const route: AppRouteObject = {
      path: 'lazy',
      // @ts-expect-error the handle goes on the route object, not in lazy
      lazy: async () => ({ handle: { title: 'Lazy page', icon: Box } }),
    };

    expect(route.handle).toBeUndefined();
  });

  it('loads and renders on navigation', async () => {
    const { router } = renderApp(
      [home, lazyRoute(() => Promise.resolve(LazyPage))],
      '/',
    );
    await screen.findByText('home page');

    await act(() => router.navigate('/lazy'));

    expect(await screen.findByText('lazy page')).toBeInTheDocument();
    expect(document.title).toBe(`Lazy page | ${APP_NAME}`);
  });
});

describe('navigation progress', () => {
  it('shows while a lazy chunk is pending and hides after', async () => {
    const chunk = deferred<typeof LazyPage>();
    const { router } = renderApp([home, lazyRoute(() => chunk.promise)], '/');
    await screen.findByText('home page');
    expect(screen.queryByRole('progressbar')).toBeNull();

    let navigation!: Promise<void>;
    act(() => {
      navigation = router.navigate('/lazy');
    });

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('home page')).toBeInTheDocument();

    await act(async () => {
      chunk.resolve(LazyPage);
      await navigation;
    });

    expect(screen.getByText('lazy page')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows inside the layout while the first chunk is pending', async () => {
    const chunk = deferred<typeof LazyPage>();
    renderApp([home, lazyRoute(() => chunk.promise)], '/lazy');

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: APP_NAME })).toBeInTheDocument();

    await act(async () => chunk.resolve(LazyPage));

    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.getByText('lazy page')).toBeInTheDocument();
  });
});
