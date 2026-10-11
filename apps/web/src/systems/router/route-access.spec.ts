import { FileText } from 'lucide-react';
import { canAccessRoute } from './route-access';
import type { RouteHandle } from './route-handle';

const open: RouteHandle = { title: 'Open', icon: FileText, public: true };
const signedIn: RouteHandle = { title: 'Signed in', icon: FileText };
const admins: RouteHandle = {
  title: 'Admins',
  icon: FileText,
  roles: ['ADMIN'],
};
const users: RouteHandle = { title: 'Users', icon: FileText, roles: ['USER'] };

const admin = { role: 'ADMIN' } as const;
const user = { role: 'USER' } as const;

describe('canAccessRoute', () => {
  describe('without a user', () => {
    it('opens a public route', () => {
      expect(canAccessRoute([undefined, open], null)).toBe(true);
    });

    it('denies a route that is not public, roles or not', () => {
      expect(canAccessRoute([undefined, signedIn], null)).toBe(false);
      expect(canAccessRoute([admins], null)).toBe(false);
    });

    it('denies a route with no handle at all', () => {
      expect(canAccessRoute([undefined, undefined], null)).toBe(false);
    });
  });

  describe('with a user', () => {
    it('opens a role-free route that is not public', () => {
      expect(canAccessRoute([signedIn], user)).toBe(true);
    });

    it('checks the roles of every matched route', () => {
      expect(canAccessRoute([admins, signedIn], admin)).toBe(true);
      expect(canAccessRoute([admins, signedIn], user)).toBe(false);
      expect(canAccessRoute([admins, users], admin)).toBe(false);
    });

    it('admits no one through an empty roles list', () => {
      expect(
        canAccessRoute([{ title: 'Nobody', icon: FileText, roles: [] }], admin),
      ).toBe(false);
    });
  });

  it('reads public from the deepest route with a handle', () => {
    // A handle-less child, like an index route, sits under its parent's.
    expect(canAccessRoute([open, undefined], null)).toBe(true);
    // A child with its own handle has to say public itself.
    expect(canAccessRoute([open, signedIn], null)).toBe(false);
  });

  it('never lets public widen a parent with roles', () => {
    // Treated as not public: the parent's roles still bind.
    expect(canAccessRoute([admins, open], null)).toBe(false);
    expect(canAccessRoute([admins, open], user)).toBe(false);
    expect(canAccessRoute([admins, open], admin)).toBe(true);
  });

  it('rejects roles on a public route at compile time', () => {
    // @ts-expect-error a public route takes no roles
    const both: RouteHandle = { ...open, roles: ['ADMIN'] };
    expect(both.public).toBe(true);
  });
});
