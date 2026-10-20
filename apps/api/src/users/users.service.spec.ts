import type {
  CreateUserInput,
  UpdateMeInput,
  UpdateUserInput,
} from '@starter/shared';
import type { AuthUser } from '../auth/auth.types.js';
import type { PasswordService } from '../auth/password.service.js';
import type { User } from '../generated/prisma/client.js';
import type { UsersRepository, UsersTransaction } from './users.repository.js';
import { UsersService } from './users.service.js';

// The rules over a stubbed repository. The lock needs a real database: the
// e2e race test in test/users.e2e-spec.ts guards its outcome.

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

function setup(users: User[], activeAdminIds: string[]) {
  const tx = {
    findById: vi.fn((id: string) =>
      Promise.resolve(users.find((u) => u.id === id) ?? null),
    ),
    findByEmail: vi.fn((email: string) =>
      Promise.resolve(users.find((u) => u.email === email) ?? null),
    ),
    update: vi.fn((id: string, data: Partial<User>) =>
      Promise.resolve({ ...users.find((u) => u.id === id)!, ...data }),
    ),
    lockActiveAdminIds: vi.fn(() => Promise.resolve(activeAdminIds)),
  } satisfies UsersTransaction;
  const repository = {
    ...tx,
    create: vi.fn((data: Pick<User, 'email' | 'name' | 'role'>) =>
      Promise.resolve({ ...USER, ...data }),
    ),
    transaction: <T>(run: (t: UsersTransaction) => Promise<T>) => run(tx),
  };
  const passwords = { hash: () => Promise.resolve('NEW-HASH') };
  const service = new UsersService(
    repository as unknown as UsersRepository,
    passwords as unknown as PasswordService,
  );
  return { service, tx, repository };
}

describe('UsersService.create', () => {
  const INPUT: CreateUserInput = {
    email: 'new@example.com',
    name: 'New',
    role: 'USER',
    password: 'a brand new password',
  };

  it('answers a taken email with a field error, creating nothing', async () => {
    const { service, repository } = setup([ADMIN, USER], [ADMIN.id]);

    await expect(
      service.create({ ...INPUT, email: USER.email }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
      errors: [{ path: 'email', code: 'EMAIL_TAKEN' }],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  // The schema normalizes; the service hands the parsed values on field by
  // field, with the password hashed.
  it('hands the repository only the known fields and the hash', async () => {
    const { service, repository } = setup([ADMIN], [ADMIN.id]);

    await service.create({ ...INPUT, isActive: false } as CreateUserInput);

    expect(repository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: 'New',
      role: 'USER',
      passwordHash: 'NEW-HASH',
    });
  });
});

describe('UsersService.enable', () => {
  it('answers 404 for an unknown id', async () => {
    const { service, tx } = setup([ADMIN], [ADMIN.id]);

    await expect(service.enable(USER.id)).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('enables a disabled user', async () => {
    const disabled = { ...USER, isActive: false };
    const { service, tx } = setup([ADMIN, disabled], [ADMIN.id]);

    await expect(service.enable(USER.id)).resolves.toMatchObject({
      isActive: true,
    });
    expect(tx.update).toHaveBeenCalledWith(USER.id, { isActive: true });
  });

  it('leaves an active user as is', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await expect(service.enable(USER.id)).resolves.toMatchObject({
      id: USER.id,
      isActive: true,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateMe', () => {
  const ME: AuthUser = { id: USER.id, sessionId: 'session', role: 'USER' };

  it('writes only the name', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.updateMe(ME, { name: 'Me', role: 'ADMIN' } as UpdateMeInput);

    expect(tx.update).toHaveBeenCalledWith(USER.id, { name: 'Me' });
  });

  it.each([
    ['a disabled caller', [ADMIN, { ...USER, isActive: false }]],
    ['a caller with no row', [ADMIN]],
  ])('answers 401 UNAUTHORIZED for %s, changing nothing', async (_, users) => {
    const { service, tx } = setup(users, [ADMIN.id]);

    await expect(service.updateMe(ME, { name: 'Me' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.disable', () => {
  it('refuses to disable the caller', async () => {
    const { service, tx } = setup(
      [ADMIN, OTHER_ADMIN],
      [ADMIN.id, OTHER_ADMIN.id],
    );

    await expect(service.disable(ACTOR, ADMIN.id)).rejects.toMatchObject({
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

describe('UsersService.setPassword', () => {
  it('refuses to set the caller password', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await expect(
      service.setPassword(ACTOR, ADMIN.id, 'a brand new password'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_SET_OWN_PASSWORD',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('sets another user password and revokes their sessions', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.setPassword(ACTOR, USER.id, 'a brand new password');

    expect(tx.update).toHaveBeenCalledWith(
      USER.id,
      { passwordHash: 'NEW-HASH' },
      { revokeSessions: {} },
    );
  });
});

describe('UsersService.update', () => {
  it('refuses to change the caller role', async () => {
    const { service, tx } = setup(
      [ADMIN, OTHER_ADMIN],
      [ADMIN.id, OTHER_ADMIN.id],
    );

    await expect(
      service.update(ACTOR, ADMIN.id, { role: 'USER' }),
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

  it('writes only the fields it knows', async () => {
    const { service, tx } = setup([ADMIN, USER], [ADMIN.id]);

    await service.update(ACTOR, USER.id, {
      name: 'New',
      isActive: false,
    } as UpdateUserInput);
    expect(tx.update).toHaveBeenCalledWith(USER.id, { name: 'New' }, {});
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
