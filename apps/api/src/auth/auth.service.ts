import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ChangePasswordInput,
  ERROR_CODES,
  type PublicUser,
} from '@starter/shared';
import { BadRequestError, UnauthorizedError } from '../common/errors/index.js';
import type { Env } from '../config/env.schema.js';
import type { Session, User } from '../generated/prisma/client.js';
import { toPublicUser } from '../users/users.mapper.js';
import { UsersRepository } from '../users/users.repository.js';
import { AccessTokenService } from './access-token.service.js';
import type { AuthUser, ClientInfo } from './auth.types.js';
import { PasswordService } from './password.service.js';
import {
  formatRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  refreshSecretMatches,
} from './refresh-token.js';
import { SessionsRepository } from './sessions.repository.js';

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
  // Set when the client must store a new cookie. A refresh inside the grace
  // window answers without one, so the cookie the browser holds stays.
  refreshToken?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

const invalidCredentials = () =>
  new UnauthorizedError(
    ERROR_CODES.INVALID_CREDENTIALS,
    'Invalid email or password',
  );

const invalidCurrentPassword = () =>
  new BadRequestError(
    ERROR_CODES.INVALID_CURRENT_PASSWORD,
    'Current password is incorrect',
    {
      errors: [
        {
          path: 'currentPassword',
          message: 'Current password is incorrect',
          code: ERROR_CODES.INVALID_CURRENT_PASSWORD,
        },
      ],
    },
  );

const invalidSession = () =>
  new UnauthorizedError(
    ERROR_CODES.INVALID_SESSION,
    'Session expired, log in again',
  );

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;
  private readonly graceMs: number;

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: AccessTokenService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs = config.get('AUTH_REFRESH_TTL', { infer: true }) * 1000;
    this.graceMs = config.get('AUTH_REFRESH_GRACE', { infer: true }) * 1000;
  }

  // Wrong email, wrong password and inactive account get the same error, and
  // an unknown email still pays for one argon2 verify.
  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      await this.passwords.verifyDummy(input.password);
      throw invalidCredentials();
    }
    const valid = await this.passwords.verify(
      user.passwordHash,
      input.password,
    );
    if (!valid || !user.isActive) throw invalidCredentials();

    const now = new Date();
    await this.sessions.deleteDead(user.id, now);

    const secret = generateRefreshSecret();
    const session = await this.sessions.create({
      userId: user.id,
      tokenHash: hashRefreshSecret(secret),
      expiresAt: new Date(now.getTime() + this.refreshTtlMs),
      ip: client.ip,
      userAgent: client.userAgent,
    });

    return {
      ...(await this.issue(user, session)),
      refreshToken: formatRefreshToken({ sessionId: session.id, secret }),
    };
  }

  async refresh(
    cookie: string | undefined,
    client: ClientInfo,
  ): Promise<AuthResult> {
    const token = parseRefreshToken(cookie);
    if (!token) throw invalidSession();

    const session = await this.sessions.findById(token.sessionId);
    const now = new Date();
    if (!session || !isLive(session, now)) throw invalidSession();

    const isCurrent = refreshSecretMatches(token.secret, session.tokenHash);
    if (!isCurrent && !this.inGrace(session, token.secret, now)) {
      // A valid session id with a secret it no longer (or never) had: the
      // token was copied. Revoking ends the session for both holders. It also
      // means anyone who knows a session id can end that session with a random
      // secret. The id is readable in the access token (sid) and the warn log.
      // Accepted: ending a session is all it gives, and the user logs in again.
      await this.sessions.revoke(session.id, now);
      this.logger.warn({ sessionId: session.id }, 'Refresh token reuse');
      throw invalidSession();
    }

    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) throw invalidSession();

    if (!isCurrent) {
      await this.sessions.touch(session.id, client.ip, now);
      return this.issue(user, session);
    }

    const secret = generateRefreshSecret();
    const rotated = await this.sessions.rotate(session.id, {
      currentHash: session.tokenHash,
      nextHash: hashRefreshSecret(secret),
      expiresAt: new Date(now.getTime() + this.refreshTtlMs),
      ip: client.ip,
      now,
    });
    if (!rotated) return this.afterLostRotation(session.id, token.secret, user);

    return {
      ...(await this.issue(user, session)),
      refreshToken: formatRefreshToken({ sessionId: session.id, secret }),
    };
  }

  // Revokes the cookie's session when the cookie proves it holds it. Never
  // fails: logging out with no cookie, or a bad one, is still a logout.
  async logout(cookie: string | undefined): Promise<void> {
    const token = parseRefreshToken(cookie);
    if (!token) return;
    const session = await this.sessions.findById(token.sessionId);
    if (!session) return;
    const holdsIt =
      refreshSecretMatches(token.secret, session.tokenHash) ||
      refreshSecretMatches(token.secret, session.previousTokenHash);
    if (holdsIt) await this.sessions.revoke(session.id, new Date());
  }

  // Fresh from the database, so a role change or deactivation shows here
  // before the access token expires. The generic UnauthorizedError code is
  // load-bearing: the web refreshes its access token only on UNAUTHORIZED,
  // so do not give it a specific code (also in changePassword below).
  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedError();
    return toPublicUser(user);
  }

  // Ends every other session of the user, so a stolen session cannot outlive
  // the password it was opened with. The caller's own session stays.
  async changePassword(
    actor: AuthUser,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.users.findById(actor.id);
    if (!user || !user.isActive) throw new UnauthorizedError();

    const valid = await this.passwords.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) throw invalidCurrentPassword();

    await this.users.update(
      user.id,
      { passwordHash: await this.passwords.hash(input.newPassword) },
      { revokeSessions: { keep: actor.sessionId } },
    );
  }

  private inGrace(session: Session, secret: string, now: Date): boolean {
    return (
      session.rotatedAt !== null &&
      now.getTime() - session.rotatedAt.getTime() <= this.graceMs &&
      refreshSecretMatches(secret, session.previousTokenHash)
    );
  }

  // A concurrent request rotated the session between our read and our
  // update. Our secret is now the previous one, so the grace rule decides.
  private async afterLostRotation(
    sessionId: string,
    secret: string,
    user: User,
  ): Promise<AuthResult> {
    const session = await this.sessions.findById(sessionId);
    const now = new Date();
    if (
      !session ||
      !isLive(session, now) ||
      !this.inGrace(session, secret, now)
    ) {
      throw invalidSession();
    }
    return this.issue(user, session);
  }

  private async issue(user: User, session: Session): Promise<AuthResult> {
    const accessToken = await this.tokens.sign({
      id: user.id,
      sessionId: session.id,
      role: user.role,
    });
    return { accessToken, user: toPublicUser(user) };
  }
}

function isLive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}
