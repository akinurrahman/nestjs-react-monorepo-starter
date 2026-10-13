import { screen } from '@testing-library/react';
import { FileText, Lock, Users } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import {
  findLoginHeading,
  preloadLoginPage,
  testUser,
} from '@/test/auth-fixtures';
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

beforeAll(preloadLoginPage, 30_000);

describe('route access', () => {
  it('renders a role-free page for any user', async () => {
    renderApp(pages, '/open', { user: testUser('USER') });

    expect(await screen.findByText('open page')).toBeInTheDocument();
  });

  it('renders a page the role is allowed on', async () => {
    renderApp(pages, '/members', { user: testUser('USER') });

    expect(await screen.findByText('members page')).toBeInTheDocument();
  });

  it('shows access denied inside the layout for a role not allowed', async () => {
    renderApp(pages, '/members', { user: testUser('ADMIN') });

    await expectDenied();
    expect(screen.queryByText('members page')).toBeNull();
  });

  it('checks the roles of every matched ancestor', async () => {
    renderApp(pages, '/admin/users', { user: testUser('USER') });

    await expectDenied();
    expect(screen.queryByText('admin users page')).toBeNull();
  });

  it('allows a nested page when every ancestor allows the role', async () => {
    renderApp(pages, '/admin/users', { user: testUser('ADMIN') });

    expect(await screen.findByText('admin users page')).toBeInTheDocument();
  });

  describe('without a user', () => {
    it('renders a public route', async () => {
      renderApp(pages, '/welcome', { user: null });

      expect(await screen.findByText('welcome page')).toBeInTheDocument();
    });

    it('redirects a route that is not public to login, keeping path and query', async () => {
      const { router } = renderApp(pages, '/open?tab=2', { user: null });

      expect(await findLoginHeading()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.search).toBe('?redirect=%2Fopen%3Ftab%3D2');
      expect(screen.queryByText('open page')).toBeNull();
    });

    it('redirects a route with roles to login', async () => {
      const { router } = renderApp(pages, '/members', { user: null });

      await findLoginHeading();
      expect(router.state.location.search).toBe('?redirect=%2Fmembers');
    });

    it('replaces the history entry, so Back does not bounce', async () => {
      const { router } = renderApp(pages, '/members', { user: null });

      await findLoginHeading();
      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('still shows the 404 for an unknown url', async () => {
      renderApp(pages, '/no/such/page', { user: null });

      expect(
        await screen.findByText(/This page does not exist/),
      ).toBeInTheDocument();
      expect(screen.queryByText('Access denied')).toBeNull();
    });
  });
});
