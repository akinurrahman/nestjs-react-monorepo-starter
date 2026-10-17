import { screen, within } from '@testing-library/react';
import { testUser } from '@/test/auth-fixtures';
import { renderApp } from '@/test/render-app';
import { makeUser, preloadRoutes, serveUsers } from '@/test/user-fixtures';
import { usersRoutes } from './routes';

const sidebar = () => screen.getByRole('navigation', { name: 'Main' });

beforeAll(() => preloadRoutes(usersRoutes), 30_000);

describe('users routes', () => {
  it('lists Users under Admin in the sidebar for an admin', async () => {
    serveUsers();
    renderApp(usersRoutes, '/users', { user: testUser('ADMIN') });

    expect(
      await within(sidebar()).findByRole('link', { name: 'Users' }),
    ).toHaveAttribute('href', '/users');
    expect(within(sidebar()).getByText('Admin')).toBeInTheDocument();
  });

  it.each(['/users', '/users/new', `/users/${makeUser(2).id}/edit`])(
    'denies a USER %s and hides the nav item',
    async (url) => {
      renderApp(usersRoutes, url, { user: testUser('USER') });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
      ).toBeInTheDocument();
      expect(
        within(sidebar()).queryByRole('link', { name: 'Users' }),
      ).toBeNull();
    },
  );
});
