import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Session } from '../generated/prisma/client.js';

export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ip: string | undefined;
  userAgent: string | undefined;
}

export interface RotateSessionData {
  currentHash: string;
  nextHash: string;
  expiresAt: Date;
  ip: string | undefined;
  now: Date;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSessionData): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  // Swaps the secret only if the session still holds `currentHash` and is
  // live, in one statement. False when another request rotated it first, or
  // it was revoked or expired in the meantime.
  async rotate(id: string, data: RotateSessionData): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        id,
        tokenHash: data.currentHash,
        revokedAt: null,
        expiresAt: { gt: data.now },
      },
      data: {
        tokenHash: data.nextHash,
        previousTokenHash: data.currentHash,
        rotatedAt: data.now,
        expiresAt: data.expiresAt,
        lastUsedAt: data.now,
        ip: data.ip,
      },
    });
    return count === 1;
  }

  async touch(id: string, ip: string | undefined, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id },
      data: { lastUsedAt: now, ip },
    });
  }

  async revoke(id: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  // Housekeeping on login: the user's sessions that can never be used again.
  async deleteDead(userId: string, now: Date): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: now } }],
      },
    });
  }
}
