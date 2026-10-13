import type { AuthUser } from '../auth/auth.types.js';
import type { PasswordService } from '../auth/password.service.js';
import type { User } from '../generated/prisma/client.js';
import type { UsersRepository, UsersTransaction } from './users.repository.js';
import { UsersService } from './users.service.js';

// The rules over a stubbed repository. The lock itself, and everything that
// needs the database, is covered by test/users.e2e-spec.ts.

const ADMIN: User = {
  id: '019a0000-0000-7000-8000-00000000000a',
  email: 'admin@example.com',
  name: 'Admin',
  passwordHash: '$argon2id$...',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
  updatedAt: new Date('2026-10-12T10:00:00.000Z'),
};

const OTHER_ADMIN: User = {
  ...ADMIN,
  id: '019a0000-0000-7000-8000-00000000000b',
  email: 'other@example.com',
};

const USER: User = {
  ...ADMIN,
  id: '019a0000-0000-7000-8000-00000000000c',
  email: 'user@example.com',
  role: 'USER',
};

const ACTOR: AuthUser = { id: ADMIN.id, sessionId: 'session', role: 'ADMIN' };

// The uuid column matches any case, so an uppercase id finds the row.
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function setup(users: User[], activeAdminIds: string[]) {
  const tx = {
    findById: vi.fn((id: string) =>
      Promise.resolve(users.find((u) => sameId(u.id, id)) ?? null),
    ),
    findByEmail: vi.fn((email: string) =>
      Promise.resolve(users.find((u) => u.email === email) ?? null),
    ),
    update: vi.fn((id: string, data: Partial<User>) =>
      Promise.resolve({ ...users.find((u) => sameId(u.id, id))!, ...data }),
    ),
    lockActiveAdminIds: vi.fn(() => Promise.resolve(activeAdminIds)),
  } satisfies UsersTransaction;
  const repository = {
    ...tx,
    transaction: <T>(run: (t: UsersTransaction) => Promise<T>) => run(tx),
  };
  const service = new UsersService(
    repository as unknown as UsersRepository,
    {} as PasswordService,
  );
  return { service, tx };
}

describe('UsersService.disable', () => {
  it.each([
    ['their id', ADMIN.id],
    ['their id in uppercase', ADMIN.id.toUpperCase()],
  ])('refuses to disable the caller by %s', async (_, id) => {
    const { service, tx } = setup(
      [ADMIN, OTHER_ADMIN],
      [ADMIN.id, OTHER_ADMIN.id],
    );

    await expect(service.disable(ACTOR, id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_DISABLE_SELF',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('refuses to disable the last active admin', async () => {
    const actor = { ...ACTOR, id: USER.id };
    const { service, tx } = setup([ADMIN], [ADMIN.id]);

    await expect(service.disable(actor, ADMIN.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_ADMIN',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('disables an admin while another is active, revoking sessions', async () => {
    const { service, tx } = setup(
      [ADMIN, OTHER_ADMIN],
      [ADMIN.id, OTHER_ADMIN.id],
    );

    await expect(service.disable(ACTOR, OTHER_ADMIN.id)).resolves.toMatchObject(
      {
        isActive: false,
      },
    );
    expect(tx.lockActiveAdminIds).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith(
      OTHER_ADMIN.id,
      { isActive: false },
      { revokeSessions: {} },
    );
  });

  it('takes no lock to disable a plain user', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.disable(ACTOR, USER.id);
    expect(tx.lockActiveAdminIds).not.toHaveBeenCalled();
  });

  it('leaves a disabled user as is', async () => {
    const disabled = { ...USER, isActive: false };
    const { service, tx } = setup([ADMIN, disabled], [ADMIN.id]);

    await expect(service.disable(ACTOR, USER.id)).resolves.toMatchObject({
      isActive: false,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.update', () => {
  it.each([
    ['their id', ADMIN.id],
    ['their id in uppercase', ADMIN.id.toUpperCase()],
  ])('refuses to change the caller role by %s', async (_, id) => {
    const { service, tx } = setup(
      [ADMIN, OTHER_ADMIN],
      [ADMIN.id, OTHER_ADMIN.id],
    );

    await expect(
      service.update(ACTOR, id, { role: 'USER' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_CHANGE_OWN_ROLE',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('lets the caller send their own unchanged role', async () => {
    const { service, tx } = setup([ADMIN], [ADMIN.id]);

    await service.update(ACTOR, ADMIN.id, { role: 'ADMIN', name: 'New' });
    expect(tx.update).toHaveBeenCalledWith(
      ADMIN.id,
      { role: 'ADMIN', name: 'New' },
      {},
    );
  });

  it('refuses to demote the last active admin', async () => {
    const actor = { ...ACTOR, id: USER.id };
    const { service } = setup([ADMIN], [ADMIN.id]);

    await expect(
      service.update(actor, ADMIN.id, { role: 'USER' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LAST_ADMIN' });
  });

  it('revokes sessions on a role change only', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.update(ACTOR, USER.id, { role: 'ADMIN' });
    expect(tx.update).toHaveBeenLastCalledWith(
      USER.id,
      { role: 'ADMIN' },
      { revokeSessions: {} },
    );

    await service.update(ACTOR, USER.id, { name: 'Renamed' });
    expect(tx.update).toHaveBeenLastCalledWith(
      USER.id,
      { name: 'Renamed' },
      {},
    );
  });

  it('answers a taken email with a field error', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await expect(
      service.update(ACTOR, USER.id, { email: ADMIN.email }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
      errors: [{ path: 'email', code: 'EMAIL_TAKEN' }],
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('accepts the user keeping their own email', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.update(ACTOR, USER.id, { email: USER.email });
    expect(tx.findByEmail).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown id', async () => {
    const { service } = setup([ADMIN], [ADMIN.id]);

    await expect(
      service.update(ACTOR, USER.id, { name: 'x' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });
});
