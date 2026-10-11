import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { House, Users } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import { useSessionStore } from '@/systems/session/session-store';
import { renderApp } from '@/test/render-app';

const pages: AppRouteObject[] = [
  {
    index: true,
    // Public, so the "without a user" case still has a page to render.
    handle: {
      title: 'Home',
      icon: House,
      nav: { group: 'General', order: 0 },
      public: true,
    },
    element: <p>home page</p>,
  },
  {
    path: 'members',
    handle: {
      title: 'Members',
      icon: Users,
      roles: ['USER'],
      nav: { group: 'General', order: 1 },
    },
    element: <p>members page</p>,
  },
];

const menuButton = () => screen.getByRole('button', { name: 'User menu' });

describe('user menu', () => {
  it('shows the user name and initials', async () => {
    renderApp(pages, '/');
    await screen.findByText('home page');

    expect(menuButton()).toHaveTextContent('DUDev Stub User');
  });

  it('has sign out, disabled until auth', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/');
    await screen.findByText('home page');

    await user.click(menuButton());

    expect(
      await screen.findByRole('menuitem', { name: 'Sign out' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('switches the stub role in dev, and the nav follows', async () => {
    const user = userEvent.setup();
    renderApp(pages, '/');
    await screen.findByText('home page');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.queryByRole('link', { name: 'Members' })).toBeNull();

    await user.click(menuButton());
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'USER' }),
    );

    expect(useSessionStore.getState().user?.role).toBe('USER');
    expect(
      await nav.findByRole('link', { name: 'Members' }),
    ).toBeInTheDocument();
  });

  it('is not shown without a user', async () => {
    useSessionStore.setState({ user: null });
    renderApp(pages, '/');
    await screen.findByText('home page');

    expect(screen.queryByRole('button', { name: 'User menu' })).toBeNull();
  });
});
