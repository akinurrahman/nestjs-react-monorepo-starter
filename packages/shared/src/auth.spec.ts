import {
  authResponseSchema,
  changePasswordSchema,
  loginSchema,
  newPasswordSchema,
  PASSWORD_MIN_LENGTH,
  publicUserSchema,
} from './auth.js';

const USER = {
  id: '019a0000-0000-7000-8000-000000000000',
  email: 'ada@example.com',
  name: 'Ada',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
};

describe('loginSchema', () => {
  it('trims and lower-cases the email before validating it', () => {
    expect(
      loginSchema.parse({ email: '  Ada@Example.COM ', password: 'x' }),
    ).toEqual({ email: 'ada@example.com', password: 'x' });
  });

  it('keeps the password as sent', () => {
    expect(
      loginSchema.parse({ email: 'a@example.com', password: ' Pass ' })
        .password,
    ).toBe(' Pass ');
  });

  it.each([
    ['a missing email', { password: 'x' }],
    ['an invalid email', { email: 'nope', password: 'x' }],
    ['a blank email', { email: '   ', password: 'x' }],
    ['an empty password', { email: 'a@example.com', password: '' }],
    [
      'a password over the cap',
      { email: 'a@example.com', password: 'x'.repeat(257) },
    ],
  ])('rejects %s', (_, value) => {
    expect(loginSchema.safeParse(value).success).toBe(false);
  });

  it('accepts a password shorter than the policy minimum', () => {
    expect(
      loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success,
    ).toBe(true);
  });
});

describe('newPasswordSchema', () => {
  it('requires the minimum length', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(newPasswordSchema.safeParse('x'.repeat(7)).success).toBe(false);
    expect(newPasswordSchema.safeParse('x'.repeat(8)).success).toBe(true);
  });

  it('caps the length', () => {
    expect(newPasswordSchema.safeParse('x'.repeat(257)).success).toBe(false);
  });

  it('keeps the password as sent', () => {
    expect(newPasswordSchema.parse('  spaced  ')).toBe('  spaced  ');
  });
});

describe('changePasswordSchema', () => {
  it('accepts any current password and a valid new one', () => {
    const body = { currentPassword: 'x', newPassword: 'long enough' };
    expect(changePasswordSchema.parse(body)).toEqual(body);
  });

  it.each([
    ['a short new password', { currentPassword: 'x', newPassword: 'short' }],
    [
      'an empty current password',
      { currentPassword: '', newPassword: 'long enough' },
    ],
    [
      'an unknown field',
      { currentPassword: 'x', newPassword: 'long enough', userId: 'x' },
    ],
  ])('rejects %s', (_, value) => {
    expect(changePasswordSchema.safeParse(value).success).toBe(false);
  });
});

describe('publicUserSchema', () => {
  it('accepts a user', () => {
    expect(publicUserSchema.parse(USER)).toEqual(USER);
  });

  it('strips a password hash', () => {
    expect(
      publicUserSchema.parse({ ...USER, passwordHash: '$argon2id$...' }),
    ).not.toHaveProperty('passwordHash');
  });

  it('rejects an unknown role', () => {
    expect(publicUserSchema.safeParse({ ...USER, role: 'OWNER' }).success).toBe(
      false,
    );
  });
});

describe('authResponseSchema', () => {
  it('accepts a token and a user', () => {
    const body = { accessToken: 'a.b.c', user: USER };
    expect(authResponseSchema.parse(body)).toEqual(body);
  });
});
