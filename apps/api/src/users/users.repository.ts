import { Injectable } from '@nestjs/common';
import type { Role } from '@starter/shared';
import { PrismaService } from '../database/prisma.service.js';
import type { User } from '../generated/prisma/client.js';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}

// Emails are stored trimmed and lower-cased. The request schemas already
// normalize them; doing it here too keeps every caller (the seed included)
// from writing or looking up another spelling.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: normalizeEmail(data.email) },
    });
  }
}
