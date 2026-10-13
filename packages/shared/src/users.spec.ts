import {
  createUserSchema,
  listUsersQuerySchema,
  setPasswordSchema,
  updateMeSchema,
  updateUserSchema,
  userIdParamSchema,
} from './users.js';

const NEW_USER = {
  email: 'ada@example.com',
  name: 'Ada',
  role: 'USER',
  password: 'long enough',
};

describe('userIdParamSchema', () => {
  it('accepts a uuid', () => {
    const id = '019a0000-0000-7000-8000-000000000000';
    expect(userIdParamSchema.parse({ id })).toEqual({ id });
  });

  it.each(['me', '123', ''])('rejects %j', (id) => {
    expect(userIdParamSchema.safeParse({ id }).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('applies the pagination defaults and leaves filters out', () => {
    expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('parses every filter from query strings', () => {
    expect(
      listUsersQuerySchema.parse({
        page: '2',
        limit: '5',
        search: '  ada ',
        role: ['ADMIN', 'USER'],
        isActive: 'false',
      }),
    ).toEqual({
      page: 2,
      limit: 5,
      search: 'ada',
      role: ['ADMIN', 'USER'],
      isActive: false,
    });
  });

  it('wraps a single role', () => {
    expect(listUsersQuerySchema.parse({ role: 'ADMIN' }).role).toEqual([
      'ADMIN',
    ]);
  });

  it.each([
    ['an unknown role', { role: 'OWNER' }],
    ['a loose boolean', { isActive: 'yes' }],
    ['a search over the cap', { search: 'x'.repeat(101) }],
  ])('rejects %s', (_, value) => {
    expect(listUsersQuerySchema.safeParse(value).success).toBe(false);
  });

  it('says one plain thing for a NUL in the search', () => {
    expect(
      listUsersQuerySchema.safeParse({ search: 'a\0b' }).error?.issues,
    ).toEqual([
      expect.objectContaining({
        path: ['search'],
        message: 'Search contains a character that is not allowed',
      }),
    ]);
  });
});

describe('createUserSchema', () => {
  it('normalizes the email and trims the name', () => {
    expect(
      createUserSchema.parse({
        ...NEW_USER,
        email: ' Ada@Example.COM ',
        name: '  Ada ',
      }),
    ).toEqual(NEW_USER);
  });

  it.each([
    ['a short password', { ...NEW_USER, password: 'x'.repeat(7) }],
    ['a password over the cap', { ...NEW_USER, password: 'x'.repeat(257) }],
    ['a blank name', { ...NEW_USER, name: '   ' }],
    ['an unknown role', { ...NEW_USER, role: 'OWNER' }],
    ['an unknown field', { ...NEW_USER, isActive: false }],
  ])('rejects %s', (_, value) => {
    expect(createUserSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ['an empty name', { ...NEW_USER, name: '' }, 'name', 'Enter a name'],
    ['a blank name', { ...NEW_USER, name: '   ' }, 'name', 'Enter a name'],
    [
      'a name over the cap',
      { ...NEW_USER, name: 'x'.repeat(101) },
      'name',
      'Name must be at most 100 characters',
    ],
    [
      'a NUL in the name',
      { ...NEW_USER, name: 'A\0da' },
      'name',
      'Name contains a character that is not allowed',
    ],
    ['an empty email', { ...NEW_USER, email: '' }, 'email', 'Enter an email'],
    [
      'a NUL in the email',
      { ...NEW_USER, email: 'a\0da@example.com' },
      'email',
      'Enter a valid email',
    ],
    [
      'an invalid email',
      { ...NEW_USER, email: 'nope' },
      'email',
      'Enter a valid email',
    ],
    ['an empty role', { ...NEW_USER, role: '' }, 'role', 'Pick a role'],
    [
      'an empty password',
      { ...NEW_USER, password: '' },
      'password',
      'Enter a password',
    ],
    [
      'a short password',
      { ...NEW_USER, password: 'short' },
      'password',
      'Password must be at least 8 characters',
    ],
  ])('says one plain thing for %s', (_, value, path, message) => {
    expect(createUserSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path: [path], message }),
    ]);
  });

  it('accepts a password of exactly the minimum length', () => {
    expect(
      createUserSchema.safeParse({ ...NEW_USER, password: 'x'.repeat(8) })
        .success,
    ).toBe(true);
  });
});

describe('updateUserSchema', () => {
  it('accepts any subset of the fields', () => {
    expect(updateUserSchema.parse({ role: 'ADMIN' })).toEqual({
      role: 'ADMIN',
    });
  });

  it.each([
    ['an empty body', {}],
    ['an unknown field', { name: 'Ada', password: 'long enough' }],
    ['a NUL in the name', { name: 'A\0da' }],
    ['a NUL in the email', { email: 'a\0da@example.com' }],
  ])('rejects %s', (_, value) => {
    expect(updateUserSchema.safeParse(value).success).toBe(false);
  });
});

describe('updateMeSchema', () => {
  it.each([
    ['a blank name', '  ', 'Enter a name'],
    [
      'a NUL in the name',
      'A\0da',
      'Name contains a character that is not allowed',
    ],
  ])('says one plain thing for %s', (_, name, message) => {
    expect(updateMeSchema.safeParse({ name }).error?.issues).toEqual([
      expect.objectContaining({ path: ['name'], message }),
    ]);
  });

  it.each([
    ['a role', { name: 'Ada', role: 'ADMIN' }],
    ['an email', { name: 'Ada', email: 'other@example.com' }],
  ])('rejects %s', (_, value) => {
    expect(updateMeSchema.safeParse(value).success).toBe(false);
  });
});

describe('setPasswordSchema', () => {
  it('applies the password policy', () => {
    expect(setPasswordSchema.safeParse({ password: 'short' }).success).toBe(
      false,
    );
  });
});
