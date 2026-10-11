import { screen, within } from '@testing-library/react';
import { BarChart, FileText, Lock, Settings } from 'lucide-react';
import { Outlet } from 'react-router';
import type { AppRouteObject } from '@/systems/router';
import { renderApp } from '@/test/render-app';

const pages: AppRouteObject[] = [
  // Groups its children, renders nothing at /admin.
  {
    path: 'admin',
    handle: { title: 'Admin', icon: Lock },
    children: [
      {
        path: 'users',
        handle: { title: 'Users', icon: FileText },
        element: <p>users page</p>,
      },
      { path: 'untitled', element: <p>untitled page</p> },
    ],
  },
  // Has an index route, so /settings is a page.
  {
    path: 'settings',
    handle: { title: 'Settings', icon: Settings },
    children: [
      { index: true, element: <p>settings page</p> },
      {
        path: 'profile',
        handle: { title: 'Profile', icon: FileText },
        element: <p>profile page</p>,
      },
    ],
  },
  // A layout: its own element is an Outlet, blank at /reports itself.
  {
    path: 'reports',
    handle: { title: 'Reports', icon: BarChart },
    element: <Outlet />,
    children: [
      {
        path: 'monthly',
        handle: { title: 'Monthly', icon: FileText },
        element: <p>monthly page</p>,
      },
    ],
  },
];

const crumbs = () =>
  within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

describe('breadcrumbs', () => {
  it('lists the titles of the current matches', async () => {
    renderApp(pages, '/admin/users');
    await screen.findByText('users page');

    expect(
      crumbs()
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Admin', 'Users']);
    expect(crumbs().getByText('Users')).toHaveAttribute('aria-current', 'page');
  });

  it('shows an ancestor without a page of its own as plain text', async () => {
    renderApp(pages, '/admin/users');
    await screen.findByText('users page');

    expect(crumbs().getByText('Admin').closest('a')).toBeNull();
    expect(crumbs().queryByRole('link')).toBeNull();
  });

  it('links an ancestor with an index route', async () => {
    renderApp(pages, '/settings/profile');
    await screen.findByText('profile page');

    expect(crumbs().getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('shows a layout parent without an index as plain text', async () => {
    renderApp(pages, '/reports/monthly');
    await screen.findByText('monthly page');

    expect(crumbs().getByText('Reports').closest('a')).toBeNull();
    expect(crumbs().queryByRole('link')).toBeNull();
  });

  it('skips matches without a title', async () => {
    renderApp(pages, '/admin/untitled');
    await screen.findByText('untitled page');

    expect(crumbs().getAllByRole('listitem')).toHaveLength(1);
    expect(crumbs().getByText('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('hides all but the current page on phones', async () => {
    renderApp(pages, '/admin/users');
    await screen.findByText('users page');

    const [ancestor, current] = crumbs().getAllByRole('listitem');
    expect(ancestor).toHaveClass('hidden', 'sm:flex');
    expect(current).not.toHaveClass('hidden');
  });
});
