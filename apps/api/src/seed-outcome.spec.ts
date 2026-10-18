import { existingUserOutcome } from './seed-outcome.js';

describe('existingUserOutcome', () => {
  it('does nothing when the email is an active admin', () => {
    expect(
      existingUserOutcome({ role: 'ADMIN', isActive: true }, true),
    ).toEqual({
      level: 'log',
      message: 'Admin user already exists, nothing to do',
    });
  });

  it.each([
    [{ role: 'USER', isActive: true }, 'is not an admin'],
    [{ role: 'ADMIN', isActive: false }, 'is disabled'],
    [{ role: 'USER', isActive: false }, 'is not an admin and is disabled'],
  ] as const)(
    'warns when %o is left as is but another active admin exists',
    (user, state) => {
      const outcome = existingUserOutcome(user, true);
      expect(outcome.level).toBe('warn');
      expect(outcome.message).toContain(`SEED_ADMIN_EMAIL ${state}`);
      expect(outcome.message).toContain('Another active admin exists');
    },
  );

  it('fails when no active admin exists at all', () => {
    const outcome = existingUserOutcome(
      { role: 'USER', isActive: true },
      false,
    );
    expect(outcome.level).toBe('error');
    expect(outcome.message).toContain('SEED_ADMIN_EMAIL is not an admin');
    expect(outcome.message).toContain('no active admin exists');
  });
});
