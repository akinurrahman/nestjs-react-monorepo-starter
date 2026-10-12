import {
  assertTestDatabaseUrl,
  readTestEnv,
  truncateAppTables,
} from './test-db.js';

describe('readTestEnv', () => {
  // AppModule ignores apps/api/.env under test, so .env.test must hold every
  // key the env schema requires.
  it('reads every key of .env.test, not just DATABASE_URL', () => {
    expect(Object.keys(readTestEnv())).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET']),
    );
  });
});

const url = (name: string) =>
  `postgresql://postgres:postgres@localhost:5432/${name}`;

describe('assertTestDatabaseUrl', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(assertTestDatabaseUrl(url('starter_test'))).toBe('starter_test');
  });

  it.each(['starter', 'starter_test_copy', 'test', 'starter-test', ''])(
    'refuses %j',
    (name) => {
      expect(() => assertTestDatabaseUrl(url(name))).toThrow(
        /must end in "_test"/,
      );
    },
  );
});

describe('truncateAppTables', () => {
  // Nothing listens on port 1, so a connection attempt would reject with a
  // connection error instead of the guard's message.
  it('refuses a non _test database before connecting', async () => {
    await expect(
      truncateAppTables('postgresql://postgres:postgres@127.0.0.1:1/starter'),
    ).rejects.toThrow(/must end in "_test"/);
  });
});
