import { screen } from '@testing-library/react';
import { FileText, Lock, Users } from 'lucide-react';
import { setStubRole } from '@/systems/session';
import { useSessionStore } from '@/systems/session/session-store';
import type { AppRouteObject } from '@/systems/router';
import { renderApp } from '@/test/render-app';
import { APP_NAME } from './config';

const pages: AppRouteObject[] = [
  {
    path: 'welcome',
    handle: { title: 'Welcome', icon: FileText, public: true },
    element: <p>welcome page</p>,
  },
  {
    path: 'open',
    handle: { title: 'Open', icon: FileText },
    element: <p>open page</p>,
  },
  {
    path: 'members',
    handle: { title: 'Members', icon: Users, roles: ['USER'] },
    element: <p>members page</p>,
  },
  {
    path: 'admin',
    handle: { title: 'Admin', icon: Lock, roles: ['ADMIN'] },
    children: [
      {
        path: 'users',
        handle: { title: 'Users', icon: Users, roles: ['ADMIN', 'USER'] },
        element: <p>admin users page</p>,
      },
    ],
  },
];

async function expectDenied() {
  expect(await screen.findByText('Access denied')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: APP_NAME })).toBeInTheDocument();
}

describe('route access', () => {
  it('renders a role-free page for any user', async () => {
    setStubRole('USER');
    renderApp(pages, '/open');

    expect(await screen.findByText('open page')).toBeInTheDocument();
  });

  it('renders a page the role is allowed on', async () => {
    setStubRole('USER');
    renderApp(pages, '/members');

    expect(await screen.findByText('members page')).toBeInTheDocument();
  });

  it('shows access denied inside the layout for a role not allowed', async () => {
    setStubRole('ADMIN');
    renderApp(pages, '/members');

    await expectDenied();
    expect(screen.queryByText('members page')).toBeNull();
  });

  it('checks the roles of every matched ancestor', async () => {
    setStubRole('USER');
    renderApp(pages, '/admin/users');

    await expectDenied();
    expect(screen.queryByText('admin users page')).toBeNull();
  });

  it('allows a nested page when every ancestor allows the role', async () => {
    setStubRole('ADMIN');
    renderApp(pages, '/admin/users');

    expect(await screen.findByText('admin users page')).toBeInTheDocument();
  });

  describe('without a user', () => {
    beforeEach(() => useSessionStore.setState({ user: null }));

    it('renders a public route', async () => {
      renderApp(pages, '/welcome');

      expect(await screen.findByText('welcome page')).toBeInTheDocument();
    });

    it('denies a route that is not public, even without roles', async () => {
      renderApp(pages, '/open');

      await expectDenied();
      expect(screen.queryByText('open page')).toBeNull();
    });

    it('denies a route with roles', async () => {
      renderApp(pages, '/members');

      await expectDenied();
    });

    it('still shows the 404 for an unknown url', async () => {
      renderApp(pages, '/no/such/page');

      expect(
        await screen.findByText(/This page does not exist/),
      ).toBeInTheDocument();
      expect(screen.queryByText('Access denied')).toBeNull();
    });
  });
});
