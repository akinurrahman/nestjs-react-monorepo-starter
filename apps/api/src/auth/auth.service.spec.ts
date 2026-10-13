import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import type { Session, User } from '../generated/prisma/client.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import {
  formatRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
} from './refresh-token.js';
import type { SessionsRepository } from './sessions.repository.js';

// The timing defence is invisible over HTTP in a test (the 401 bodies are
// identical either way), so it is checked here: an unknown email must still
// run an argon2 verify. The lost rotation race is checked here too, because
// losing it on purpose needs a stubbed repository.

const CLIENT = { ip: '127.0.0.1', userAgent: 'vitest' };

const USER: User = {
  id: '019a1b2c-3d4e-7f00-8a00-0123456789ab',
  email: 'ada@example.com',
  name: 'Ada',
  passwordHash: '$argon2id$...',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup(user: User | null) {
  const users = { findByEmail: vi.fn().mockResolvedValue(user) };
  const passwords = {
    verify: vi.fn().mockResolvedValue(false),
    verifyDummy: vi.fn().mockResolvedValue(undefined),
  };
  const config = { get: () => 60 };
  const service = new AuthService(
    users as unknown as UsersRepository,
    {} as SessionsRepository,
    passwords as unknown as PasswordService,
    {} as AccessTokenService,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, passwords };
}

describe('AuthService.login', () => {
  it('runs the dummy verify for an unknown email', async () => {
    const { service, passwords } = setup(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }, CLIENT),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(passwords.verifyDummy).toHaveBeenCalledWith('x');
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('verifies against the stored hash for a known email', async () => {
    const { service, passwords } = setup(USER);

    await expect(
      service.login({ email: USER.email, password: 'x' }, CLIENT),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(passwords.verify).toHaveBeenCalledWith(USER.passwordHash, 'x');
    expect(passwords.verifyDummy).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh when another request rotates first', () => {
  const SESSION_ID = '019a1b2c-3d4e-7f00-8a00-0123456789cd';
  const secret = generateRefreshSecret();
  const cookie = formatRefreshToken({ sessionId: SESSION_ID, secret });

  const heldSession: Session = {
    id: SESSION_ID,
    userId: USER.id,
    tokenHash: hashRefreshSecret(secret),
    previousTokenHash: null,
    rotatedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    revokedAt: null,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    ip: undefined,
    userAgent: undefined,
  } as unknown as Session;

  // What the row looks like after the winner rotated: our secret is the
  // previous one now.
  const rotatedSession: Session = {
    ...heldSession,
    tokenHash: hashRefreshSecret(generateRefreshSecret()),
    previousTokenHash: heldSession.tokenHash,
    rotatedAt: new Date(),
  };

  // The first read sees the session before the winner's update, the second
  // one after it. The conditional update reports the lost race.
  function setupLostRace(afterRace: Session | null) {
    const sessions = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(heldSession)
        .mockResolvedValueOnce(afterRace),
      rotate: vi.fn().mockResolvedValue(false),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    const users = { findById: vi.fn().mockResolvedValue(USER) };
    const tokens = { sign: vi.fn().mockResolvedValue('ACCESS') };
    const service = new AuthService(
      users as unknown as UsersRepository,
      sessions as unknown as SessionsRepository,
      {} as PasswordService,
      tokens as unknown as AccessTokenService,
      { get: () => 60 } as unknown as ConfigService<Env, true>,
    );
    return { service, sessions };
  }

  it('answers inside the grace window without a new cookie', async () => {
    const { service, sessions } = setupLostRace(rotatedSession);

    const result = await service.refresh(cookie, CLIENT);

    expect(result.accessToken).toBe('ACCESS');
    expect(result.refreshToken).toBeUndefined();
    expect(sessions.rotate).toHaveBeenCalledTimes(1);
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('refuses when the session was revoked in the meantime', async () => {
    const { service } = setupLostRace({
      ...rotatedSession,
      revokedAt: new Date(),
    });

    await expect(service.refresh(cookie, CLIENT)).rejects.toMatchObject({
      code: 'INVALID_SESSION',
    });
  });

  it('refuses when the rotation is older than the grace window', async () => {
    const { service } = setupLostRace({
      ...rotatedSession,
      rotatedAt: new Date(Date.now() - 61_000),
    });

    await expect(service.refresh(cookie, CLIENT)).rejects.toMatchObject({
      code: 'INVALID_SESSION',
    });
  });
});
