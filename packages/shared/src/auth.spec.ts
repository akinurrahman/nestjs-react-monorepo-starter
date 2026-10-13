import {
  authResponseSchema,
  changePasswordSchema,
  emailSchema,
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
    [
      'an unknown field',
      { email: 'a@example.com', password: 'x', remember: true },
    ],
  ])('rejects %s', (_, value) => {
    expect(loginSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    [
      'an empty email',
      { email: '', password: 'x' },
      'email',
      'Enter your email',
    ],
    [
      'a blank email',
      { email: '   ', password: 'x' },
      'email',
      'Enter your email',
    ],
    ['a missing email', { password: 'x' }, 'email', 'Enter your email'],
    [
      'an invalid email',
      { email: 'nope', password: 'x' },
      'email',
      'Enter a valid email',
    ],
    [
      'an email over the cap',
      { email: `${'a'.repeat(250)}@example.com`, password: 'x' },
      'email',
      'Enter a valid email',
    ],
    [
      'an empty password',
      { email: 'a@example.com', password: '' },
      'password',
      'Enter your password',
    ],
    [
      'a missing password',
      { email: 'a@example.com' },
      'password',
      'Enter your password',
    ],
  ])('says one plain thing for %s', (_, value, path, message) => {
    const result = loginSchema.safeParse(value);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: [path], message }),
    ]);
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

  it.each([
    ['a missing password', undefined, 'Enter a password'],
    ['an empty password', '', 'Enter a password'],
    [
      'a short password',
      'x'.repeat(7),
      'Password must be at least 8 characters',
    ],
    [
      'a password over the cap',
      'x'.repeat(257),
      'Password must be at most 256 characters',
    ],
  ])('says one plain thing for %s', (_, value, message) => {
    expect(newPasswordSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ message }),
    ]);
  });
});

describe('emailSchema', () => {
  it('trims and lower-cases the email', () => {
    expect(emailSchema.parse('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each([
    ['a missing email', undefined, 'Enter an email'],
    ['an empty email', '', 'Enter an email'],
    ['a blank email', '   ', 'Enter an email'],
    ['an invalid email', 'nope', 'Enter a valid email'],
    [
      'an email over the cap',
      `${'a'.repeat(250)}@example.com`,
      'Enter a valid email',
    ],
  ])('says one plain thing for %s', (_, value, message) => {
    expect(emailSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ message }),
    ]);
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

  it.each([
    [
      'an empty current password',
      { currentPassword: '', newPassword: 'long enough' },
      'currentPassword',
      'Enter your current password',
    ],
    [
      'a missing current password',
      { newPassword: 'long enough' },
      'currentPassword',
      'Enter your current password',
    ],
    [
      'a short new password',
      { currentPassword: 'x', newPassword: 'short' },
      'newPassword',
      'Password must be at least 8 characters',
    ],
  ])('says one plain thing for %s', (_, value, path, message) => {
    expect(changePasswordSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path: [path], message }),
    ]);
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
