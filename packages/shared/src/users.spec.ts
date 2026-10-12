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
  ])('rejects %s', (_, value) => {
    expect(updateUserSchema.safeParse(value).success).toBe(false);
  });
});

describe('updateMeSchema', () => {
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
