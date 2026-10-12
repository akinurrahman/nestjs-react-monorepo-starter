import type { Role } from '@starter/shared';
import { Box, FileText, Folder, Lock, Users } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import { buildNav } from './nav';

const GROUPS = ['Main', 'People', 'Admin'];

// Most cases are about ordering, not access, so they run as a user that
// every role-free route admits.
const SIGNED_IN = { role: 'USER' } as const;

const page = (
  path: string,
  title: string,
  nav: { group: string; order: number },
  roles?: Role[],
): AppRouteObject => ({
  path,
  handle: { title, icon: FileText, nav, roles },
  element: null,
});

const titles = (groups: ReturnType<typeof buildNav>) =>
  groups.map((group) => [group.label, group.items.map((item) => item.title)]);

describe('buildNav', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('builds from the config, before any lazy chunk loads', () => {
    const load = vi.fn(async () => ({ Component: () => null }));
    const routes: AppRouteObject[] = [
      {
        path: 'reports',
        handle: {
          title: 'Reports',
          icon: Box,
          nav: { group: 'Main', order: 1 },
        },
        lazy: load,
      },
    ];

    expect(buildNav(routes, SIGNED_IN, GROUPS)).toEqual([
      {
        label: 'Main',
        items: [
          {
            path: '/reports',
            title: 'Reports',
            icon: Box,
            order: 1,
            keywords: [],
          },
        ],
      },
    ]);
    expect(load).not.toHaveBeenCalled();
  });

  it('orders groups by NAV_GROUPS, not by config order', () => {
    const routes = [
      page('settings', 'Settings', { group: 'Admin', order: 0 }),
      page('people', 'People', { group: 'People', order: 0 }),
      page('home', 'Home', { group: 'Main', order: 0 }),
    ];

    expect(buildNav(routes, SIGNED_IN, GROUPS).map((g) => g.label)).toEqual([
      'Main',
      'People',
      'Admin',
    ]);
  });

  it('orders items by nav.order', () => {
    const routes = [
      page('c', 'Third', { group: 'Main', order: 3 }),
      page('a', 'First', { group: 'Main', order: 1 }),
      page('b', 'Second', { group: 'Main', order: 2 }),
    ];

    expect(titles(buildNav(routes, SIGNED_IN, GROUPS))).toEqual([
      ['Main', ['First', 'Second', 'Third']],
    ]);
  });

  describe('access', () => {
    const routes: AppRouteObject[] = [
      {
        path: 'welcome',
        handle: {
          title: 'Welcome',
          icon: FileText,
          nav: { group: 'Main', order: -1 },
          public: true,
        },
        element: null,
      },
      page('open', 'Open', { group: 'Main', order: 0 }),
      page('members', 'Members', { group: 'Main', order: 1 }, ['USER']),
      {
        path: 'admin',
        handle: { title: 'Admin', icon: Lock, roles: ['ADMIN'] },
        children: [
          page('users', 'Users', { group: 'Admin', order: 0 }, [
            'ADMIN',
            'USER',
          ]),
        ],
      },
    ];

    it('lists what the role may open, ancestors included', () => {
      expect(titles(buildNav(routes, { role: 'USER' }, GROUPS))).toEqual([
        ['Main', ['Welcome', 'Open', 'Members']],
      ]);
      expect(titles(buildNav(routes, { role: 'ADMIN' }, GROUPS))).toEqual([
        ['Main', ['Welcome', 'Open']],
        ['Admin', ['Users']],
      ]);
    });

    it('lists only public routes without a user', () => {
      expect(titles(buildNav(routes, null, GROUPS))).toEqual([
        ['Main', ['Welcome']],
      ]);
    });

    it('joins nested paths', () => {
      const [, admin] = buildNav(routes, { role: 'ADMIN' }, GROUPS);
      expect(admin?.items[0]?.path).toBe('/admin/users');
    });
  });

  it('lists an index route at its parent path', () => {
    const routes: AppRouteObject[] = [
      {
        index: true,
        handle: {
          title: 'Home',
          icon: Folder,
          nav: { group: 'Main', order: 0 },
        },
        element: null,
      },
    ];

    expect(buildNav(routes, SIGNED_IN, GROUPS)[0]?.items[0]?.path).toBe('/');
  });

  it('warns about a group not in NAV_GROUPS and lists it last', () => {
    const routes = [
      page('extra', 'Extra', { group: 'Mystery', order: 0 }),
      page('home', 'Home', { group: 'Main', order: 0 }),
    ];

    expect(titles(buildNav(routes, SIGNED_IN, GROUPS))).toEqual([
      ['Main', ['Home']],
      ['Mystery', ['Extra']],
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"Mystery" is not in NAV_GROUPS'),
    );
  });

  it('warns about a public route under a roles parent and treats it as not public', () => {
    const routes: AppRouteObject[] = [
      {
        path: 'admin',
        handle: { title: 'Admin', icon: Lock, roles: ['ADMIN'] },
        children: [
          {
            path: 'help',
            handle: {
              title: 'Admin help',
              icon: FileText,
              nav: { group: 'Admin', order: 0 },
              public: true,
            },
            element: null,
          },
        ],
      },
    ];

    expect(buildNav(routes, null, GROUPS)).toEqual([]);
    expect(titles(buildNav(routes, { role: 'ADMIN' }, GROUPS))).toEqual([
      ['Admin', ['Admin help']],
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      '[nav] public route "Admin help" on /admin/help under a roles parent is treated as not public.',
    );
  });

  it('warns about nav on a path with params and skips it', () => {
    const routes = [
      page('employees', 'Employees', { group: 'People', order: 0 }),
      page('employees/:id', 'Employee', { group: 'People', order: 1 }),
      {
        path: 'files',
        children: [page('*', 'Any file', { group: 'People', order: 2 })],
      },
    ];

    expect(titles(buildNav(routes, SIGNED_IN, GROUPS))).toEqual([
      ['People', ['Employees']],
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/employees/:id'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/files/*'),
    );
  });

  it('carries keywords from the handle', () => {
    const routes: AppRouteObject[] = [
      {
        path: 'payroll',
        handle: {
          title: 'Payroll',
          icon: Box,
          nav: { group: 'Main', order: 0 },
          keywords: ['salary', 'payslip'],
        },
        element: null,
      },
    ];

    expect(buildNav(routes, SIGNED_IN, GROUPS)[0]?.items[0]?.keywords).toEqual([
      'salary',
      'payslip',
    ]);
  });
  it('skips routes without nav', () => {
    const routes: AppRouteObject[] = [
      {
        path: 'hidden',
        handle: { title: 'Hidden', icon: Users },
        element: null,
      },
    ];

    expect(buildNav(routes, SIGNED_IN, GROUPS)).toEqual([]);
  });
});
