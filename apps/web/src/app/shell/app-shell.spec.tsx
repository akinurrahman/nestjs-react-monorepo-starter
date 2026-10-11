import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, House, Lock } from 'lucide-react';
import { useSidebarStore } from '@/components/ui/sidebar';
import type { AppRouteObject } from '@/systems/router';
import { setStubRole } from '@/systems/session';
import { useSessionStore } from '@/systems/session/session-store';
import { setViewportWidth } from '@/test/match-media';
import { renderApp } from '@/test/render-app';

function Throws(): never {
  throw new Error('kaboom');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const pages: AppRouteObject[] = [
  {
    index: true,
    handle: { title: 'Home', icon: House, nav: { group: 'General', order: 0 } },
    element: <p>home page</p>,
  },
  {
    path: 'reports',
    handle: {
      title: 'Reports',
      icon: FileText,
      nav: { group: 'General', order: 1 },
    },
    element: <p>reports page</p>,
  },
  {
    path: 'members',
    handle: { title: 'Members', icon: Lock, roles: ['USER'] },
    element: <p>members page</p>,
  },
  { path: 'throws', Component: Throws },
];

const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const sidebar = () => document.querySelector('[data-slot="sidebar"]');
const trigger = () =>
  document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]')!;

describe('app shell', () => {
  beforeEach(() => {
    useSidebarStore.setState(useSidebarStore.getInitialState(), true);
    useSessionStore.setState(useSessionStore.getInitialState(), true);
  });

  it('lists nav entries and marks the active one', async () => {
    renderApp(pages, '/reports');
    await screen.findByText('reports page');

    const nav = within(mainNav());
    expect(nav.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('lists a lazy route before its chunk loads', async () => {
    const chunk = deferred<() => null>();
    const lazyPage: AppRouteObject = {
      path: 'later',
      handle: {
        title: 'Later',
        icon: FileText,
        nav: { group: 'General', order: 2 },
      },
      lazy: async () => ({ Component: await chunk.promise }),
    };
    renderApp([...pages, lazyPage], '/');
    await screen.findByText('home page');

    expect(
      within(mainNav()).getByRole('link', { name: 'Later' }),
    ).toBeInTheDocument();
  });

  it('keeps the collapsed state across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(pages, '/');
    await screen.findByText('home page');

    await user.click(trigger());
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    first.unmount();

    // Drop the in-memory state so only storage can bring it back. The reset
    // writes through to storage, so the saved value is put back first.
    const stored = localStorage.getItem('ui-sidebar');
    expect(JSON.parse(stored ?? '{}').state).toEqual({ open: false });
    useSidebarStore.setState(useSidebarStore.getInitialState(), true);
    localStorage.setItem('ui-sidebar', stored!);
    await act(() => useSidebarStore.persist.rehydrate());
    renderApp(pages, '/');
    await screen.findByText('home page');

    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
  });

  it('closes the mobile sheet after a nav click', async () => {
    setViewportWidth(500);
    const user = userEvent.setup();
    renderApp(pages, '/');
    await screen.findByText('home page');

    await user.click(trigger());
    const sheet = await screen.findByRole('dialog');

    await user.click(within(sheet).getByRole('link', { name: 'Reports' }));

    expect(await screen.findByText('reports page')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus to main from the skip link', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/');
    await screen.findByText('home page');

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('main')).toHaveFocus();
  });

  describe('inside the shell', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('shows the 404', async () => {
      renderApp(pages, '/no/such/page');

      expect(
        await within(screen.getByRole('main')).findByText('Not found'),
      ).toBeInTheDocument();
      expect(mainNav()).toBeInTheDocument();
    });

    it('shows access denied', async () => {
      setStubRole('ADMIN');
      renderApp(pages, '/members');

      expect(
        await within(screen.getByRole('main')).findByText('Access denied'),
      ).toBeInTheDocument();
      expect(mainNav()).toBeInTheDocument();
    });

    it('shows a page that throws', async () => {
      renderApp(pages, '/throws');

      expect(
        await within(screen.getByRole('main')).findByRole('alert'),
      ).toHaveTextContent('This page could not be shown');
      expect(mainNav()).toBeInTheDocument();
    });
  });
});
