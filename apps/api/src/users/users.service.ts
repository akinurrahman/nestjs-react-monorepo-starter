import { Injectable } from '@nestjs/common';
import {
  type CreateUserInput,
  type ListUsersQuery,
  type PublicUser,
  type UpdateMeInput,
  type UpdateUserInput,
  USER_ERROR_CODES,
} from '@starter/shared';
import { PasswordService } from '../auth/password.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../common/errors/index.js';
import { paginate, type PaginatedResult } from '../common/pagination/index.js';
import type { User } from '../generated/prisma/client.js';
import { toPublicUser } from './users.mapper.js';
import { UsersRepository, type UsersTransaction } from './users.repository.js';

const userNotFound = () =>
  new NotFoundError(USER_ERROR_CODES.USER_NOT_FOUND, 'User not found');

const emailTaken = () =>
  new ConflictError(USER_ERROR_CODES.EMAIL_TAKEN, 'Email is already in use', {
    errors: [
      {
        path: 'email',
        message: 'Email is already in use',
        code: USER_ERROR_CODES.EMAIL_TAKEN,
      },
    ],
  });

// Admin management of users, plus a user's own profile. Every rule lives
// here; the repository only reads and writes.
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedResult<PublicUser>> {
    const { items, total } = await this.users.list(query);
    return paginate(items.map(toPublicUser), total, query);
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    return toPublicUser(user);
  }

  // The unique index still backs the email check: a concurrent create with
  // the same email ends in P2002, which the global filter answers with 409.
  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await this.users.findByEmail(input.email)) throw emailTaken();
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await this.passwords.hash(input.password),
    });
    return toPublicUser(user);
  }

  // A role change ends the user's sessions, so the new role applies from
  // their next login.
  async update(
    actor: AuthUser,
    id: string,
    input: UpdateUserInput,
  ): Promise<PublicUser> {
    return this.users.transaction(async (tx) => {
      const user = await tx.findById(id);
      if (!user) throw userNotFound();

      const roleChanges = input.role !== undefined && input.role !== user.role;
      if (roleChanges && user.id === actor.id) {
        throw new ForbiddenError(
          USER_ERROR_CODES.CANNOT_CHANGE_OWN_ROLE,
          'You cannot change your own role',
        );
      }
      if (input.email !== undefined && input.email !== user.email) {
        if (await tx.findByEmail(input.email)) throw emailTaken();
      }
      if (roleChanges && input.role !== 'ADMIN') {
        await assertNotLastAdmin(tx, user);
      }

      const updated = await tx.update(id, input, {
        ...(roleChanges && { revokeSessions: {} }),
      });
      return toPublicUser(updated);
    });
  }

  async disable(actor: AuthUser, id: string): Promise<PublicUser> {
    if (id === actor.id) {
      throw new ForbiddenError(
        USER_ERROR_CODES.CANNOT_DISABLE_SELF,
        'You cannot disable your own account',
      );
    }
    return this.users.transaction(async (tx) => {
      const user = await tx.findById(id);
      if (!user) throw userNotFound();
      if (!user.isActive) return toPublicUser(user);

      await assertNotLastAdmin(tx, user);
      const updated = await tx.update(
        id,
        { isActive: false },
        { revokeSessions: {} },
      );
      return toPublicUser(updated);
    });
  }

  async enable(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    if (user.isActive) return toPublicUser(user);
    return toPublicUser(await this.users.update(id, { isActive: true }));
  }

  async setPassword(id: string, password: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    await this.users.update(
      id,
      { passwordHash: await this.passwords.hash(password) },
      { revokeSessions: {} },
    );
  }

  // Same check as AuthService.me: a disabled user's access token still
  // verifies until it expires, but it changes nothing.
  async updateMe(actor: AuthUser, input: UpdateMeInput): Promise<PublicUser> {
    const user = await this.users.findById(actor.id);
    if (!user || !user.isActive) throw new UnauthorizedError();
    return toPublicUser(await this.users.update(user.id, { name: input.name }));
  }
}

// Throws when taking `user` out of the active admins would leave none. Runs
// inside the caller's transaction and locks the active admin rows first, so
// of two requests removing the last two admins, the second waits for the
// first to commit and then sees one admin left.
async function assertNotLastAdmin(
  tx: UsersTransaction,
  user: Pick<User, 'id' | 'role' | 'isActive'>,
): Promise<void> {
  if (user.role !== 'ADMIN' || !user.isActive) return;
  const adminIds = await tx.lockActiveAdminIds();
  if (adminIds.every((adminId) => adminId === user.id)) {
    throw new ConflictError(
      USER_ERROR_CODES.LAST_ADMIN,
      'The last active admin cannot be disabled or demoted',
    );
  }
}
