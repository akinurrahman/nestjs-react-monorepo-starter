import { assertTestDatabaseUrl, truncateAppTables } from './test-db.js';

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
