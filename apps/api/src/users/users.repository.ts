import { Injectable } from '@nestjs/common';
import type { Role } from '@starter/shared';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, User } from '../generated/prisma/client.js';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  passwordHash?: string;
}

export interface UpdateUserOptions {
  // Revokes the user's live sessions in the same statement as the update.
  // `keep` spares one session, the caller's own.
  revokeSessions?: { keep?: string };
}

export interface ListUsersFilter {
  page: number;
  limit: number;
  search?: string;
  role?: Role[];
  isActive?: boolean;
}

// The reads and writes a service may run inside one transaction.
export interface UsersTransaction {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(
    id: string,
    data: UpdateUserData,
    options?: UpdateUserOptions,
  ): Promise<User>;
  // Locks every active admin row (SELECT ... FOR UPDATE) until the
  // transaction ends and returns their ids. A concurrent transaction that
  // asks for the same lock waits, then sees the rows as committed.
  lockActiveAdminIds(): Promise<string[]>;
}

type Db = Prisma.TransactionClient;

// Emails are stored trimmed and lower-cased. The request schemas already
// normalize them; doing it here too keeps every caller (the seed included)
// from writing or looking up another spelling.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findById(db: Db, id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

function findByEmail(db: Db, email: string): Promise<User | null> {
  return db.user.findUnique({ where: { email: normalizeEmail(email) } });
}

function update(
  db: Db,
  id: string,
  data: UpdateUserData,
  { revokeSessions }: UpdateUserOptions = {},
): Promise<User> {
  return db.user.update({
    where: { id },
    data: {
      ...data,
      ...(data.email !== undefined && { email: normalizeEmail(data.email) }),
      ...(revokeSessions && {
        sessions: {
          updateMany: {
            where: {
              revokedAt: null,
              ...(revokeSessions.keep !== undefined && {
                id: { not: revokeSessions.keep },
              }),
            },
            data: { revokedAt: new Date() },
          },
        },
      }),
    },
  });
}

async function lockActiveAdminIds(db: Db): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'ADMIN' AND is_active FOR UPDATE`;
  return rows.map((row) => row.id);
}

// Prisma passes `contains` to ILIKE as is, so % and _ would act as
// wildcards. Backslash is the default LIKE escape character in Postgres.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function listWhere({
  search,
  role,
  isActive,
}: ListUsersFilter): Prisma.UserWhereInput {
  const contains = search && escapeLike(search);
  return {
    ...(contains && {
      OR: [
        { name: { contains, mode: 'insensitive' } },
        { email: { contains, mode: 'insensitive' } },
      ],
    }),
    ...(role && { role: { in: role } }),
    ...(isActive !== undefined && { isActive }),
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return findByEmail(this.prisma, email);
  }

  findById(id: string): Promise<User | null> {
    return findById(this.prisma, id);
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: normalizeEmail(data.email) },
    });
  }

  update(
    id: string,
    data: UpdateUserData,
    options?: UpdateUserOptions,
  ): Promise<User> {
    return update(this.prisma, id, data, options);
  }

  // Newest first; id breaks ties so pages never overlap.
  async list(
    filter: ListUsersFilter,
  ): Promise<{ items: User[]; total: number }> {
    const where = listWhere(filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  transaction<T>(run: (tx: UsersTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((db) =>
      run({
        findById: (id) => findById(db, id),
        findByEmail: (email) => findByEmail(db, email),
        update: (id, data, options) => update(db, id, data, options),
        lockActiveAdminIds: () => lockActiveAdminIds(db),
      }),
    );
  }
}
