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

  it('lower-cases an uppercase uuid', () => {
    expect(
      userIdParamSchema.parse({ id: '019A0000-0000-7000-8000-00000000ABCD' }),
    ).toEqual({ id: '019a0000-0000-7000-8000-00000000abcd' });
  });

  it.each(['me', '123', ''])('rejects %j on the id', (id) => {
    expect(userIdParamSchema.safeParse({ id }).error?.issues).toEqual([
      expect.objectContaining({ path: ['id'], message: 'Invalid UUID' }),
    ]);
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

  it.each(['', '   '])('parses the search %j as no filter', (search) => {
    expect(listUsersQuerySchema.parse({ search }).search).toBeUndefined();
  });

  it('wraps a single role', () => {
    expect(listUsersQuerySchema.parse({ role: 'ADMIN' }).role).toEqual([
      'ADMIN',
    ]);
  });

  it.each([
    ['an unknown role', { role: 'OWNER' }, ['role', 0], 'Pick a role'],
    [
      'a loose boolean',
      { isActive: 'yes' },
      ['isActive'],
      'Invalid option: expected one of "true"|"false"',
    ],
    [
      'a search over the cap',
      { search: 'x'.repeat(101) },
      ['search'],
      'Too big: expected string to have <=100 characters',
    ],
  ])('rejects %s', (_, value, path, message) => {
    expect(listUsersQuerySchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path, message }),
    ]);
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

  // A short password and a blank name are in the table below.
  it.each([
    [
      'a password over the cap',
      { ...NEW_USER, password: 'x'.repeat(257) },
      ['password'],
      'Password must be at most 256 characters',
    ],
    [
      'an unknown role',
      { ...NEW_USER, role: 'OWNER' },
      ['role'],
      'Pick a role',
    ],
    [
      'an unknown field',
      { ...NEW_USER, isActive: false },
      [],
      'Unrecognized key: "isActive"',
    ],
  ])('rejects %s', (_, value, path, message) => {
    expect(createUserSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path, message }),
    ]);
  });

  it.each([
    ['a name of exactly the maximum length', { name: 'x'.repeat(100) }],
    ['a password of exactly the maximum length', { password: 'x'.repeat(256) }],
  ])('accepts %s', (_, patch) => {
    expect(createUserSchema.safeParse({ ...NEW_USER, ...patch }).success).toBe(
      true,
    );
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
    ['an empty body', {}, [], 'Provide at least one field to update'],
    [
      'an unknown field',
      { name: 'Ada', password: 'long enough' },
      [],
      'Unrecognized key: "password"',
    ],
    [
      'a NUL in the name',
      { name: 'A\0da' },
      ['name'],
      'Name contains a character that is not allowed',
    ],
    [
      'a NUL in the email',
      { email: 'a\0da@example.com' },
      ['email'],
      'Enter a valid email',
    ],
  ])('rejects %s', (_, value, path, message) => {
    expect(updateUserSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path, message }),
    ]);
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
    ['a role', { name: 'Ada', role: 'ADMIN' }, 'Unrecognized key: "role"'],
    [
      'an email',
      { name: 'Ada', email: 'other@example.com' },
      'Unrecognized key: "email"',
    ],
  ])('rejects %s', (_, value, message) => {
    expect(updateMeSchema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({ path: [], message }),
    ]);
  });
});

describe('setPasswordSchema', () => {
  it.each([
    ['a short password', 'short', 'Password must be at least 8 characters'],
    [
      'a password over the cap',
      'x'.repeat(257),
      'Password must be at most 256 characters',
    ],
  ])('rejects %s', (_, password, message) => {
    expect(setPasswordSchema.safeParse({ password }).error?.issues).toEqual([
      expect.objectContaining({ path: ['password'], message }),
    ]);
  });

  it('accepts a password of exactly the maximum length', () => {
    expect(
      setPasswordSchema.safeParse({ password: 'x'.repeat(256) }).success,
    ).toBe(true);
  });
});
