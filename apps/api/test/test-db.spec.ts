import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertTestDatabaseUrl,
  localDbPort,
  readTestEnv,
  truncateAppTables,
  withDbPort,
} from './test-db.js';

describe('readTestEnv', () => {
  // AppModule ignores apps/api/.env under test, so .env.test must hold every
  // key the env schema requires.
  it('reads every key of .env.test, not just DATABASE_URL', () => {
    expect(Object.keys(readTestEnv())).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET']),
    );
  });

  it('moves DATABASE_URL to DB_PORT when that is set', () => {
    vi.stubEnv('DB_PORT', '5439');
    try {
      expect(new URL(readTestEnv()['DATABASE_URL']!).port).toBe('5439');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('localDbPort', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'db-port-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prefers DB_PORT from the environment', () => {
    const file = join(dir, '.env');
    writeFileSync(file, 'DB_PORT=5433\n');
    expect(localDbPort({ DB_PORT: '5434' }, file)).toBe('5434');
  });

  it('falls back to the root .env', () => {
    const file = join(dir, '.env');
    writeFileSync(file, 'DB_PORT=5433\n');
    expect(localDbPort({}, file)).toBe('5433');
  });

  it('is undefined with neither, as in CI', () => {
    expect(localDbPort({}, join(dir, 'missing.env'))).toBeUndefined();
  });

  it('refuses a value that is not a port', () => {
    expect(() => localDbPort({ DB_PORT: 'abc' }, join(dir, 'x'))).toThrow(
      /must be a port number/,
    );
  });
});

describe('withDbPort', () => {
  it('replaces the port and keeps the rest', () => {
    expect(
      withDbPort(
        'postgresql://postgres:postgres@localhost:5432/x_test',
        '5433',
      ),
    ).toBe('postgresql://postgres:postgres@localhost:5433/x_test');
  });

  it('leaves the url alone without a port', () => {
    const url = 'postgresql://postgres:postgres@localhost:5432/x_test';
    expect(withDbPort(url, undefined)).toBe(url);
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
