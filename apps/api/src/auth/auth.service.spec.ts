import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import type { User } from '../generated/prisma/client.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { SessionsRepository } from './sessions.repository.js';

// The timing defence is invisible over HTTP in a test (the 401 bodies are
// identical either way), so it is checked here: an unknown email must still
// run an argon2 verify.

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
