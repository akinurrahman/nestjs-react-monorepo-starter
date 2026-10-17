import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';

// Also run directly by `pnpm db:test:prepare` through Node's type stripping,
// so this file imports no relative modules and uses erasable syntax only.

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));

const TEST_ENV_FILE = resolve(API_ROOT, '.env.test');

// The gitignored root .env, which docker compose reads DB_PORT from.
const ROOT_ENV_FILE = resolve(API_ROOT, '../../.env');

// Where the local Postgres listens, when it is not the 5432 that .env.test
// commits: DB_PORT from the environment, else from the root .env. CI has
// neither, so it keeps 5432.
export function localDbPort(
  env: NodeJS.ProcessEnv = process.env,
  rootEnvFile: string = ROOT_ENV_FILE,
): string | undefined {
  const port =
    env['DB_PORT'] ||
    (existsSync(rootEnvFile)
      ? parseEnv(readFileSync(rootEnvFile, 'utf8'))['DB_PORT']
      : undefined);
  if (!port) return undefined;
  if (!/^\d{1,5}$/.test(port)) {
    throw new Error(`DB_PORT must be a port number, got "${port}"`);
  }
  return port;
}

export function withDbPort(url: string, port: string | undefined): string {
  if (!port) return url;
  const next = new URL(url);
  next.port = port;
  return next.toString();
}

// Every key in .env.test, with the port moved to DB_PORT when that is set.
// The e2e setup puts them all in process.env, and AppModule ignores
// apps/api/.env under NODE_ENV=test, so this is the whole environment the
// tests see.
export function readTestEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(TEST_ENV_FILE, 'utf8')),
  )) {
    if (value !== undefined) env[key] = value;
  }
  if (env['DATABASE_URL']) {
    env['DATABASE_URL'] = withDbPort(env['DATABASE_URL'], localDbPort());
  }
  return env;
}

export function readTestDatabaseUrl(
  env: Record<string, string> = readTestEnv(),
): string {
  const url = env['DATABASE_URL'];
  if (!url) throw new Error(`DATABASE_URL is missing from ${TEST_ENV_FILE}`);
  assertTestDatabaseUrl(url);
  return url;
}

// Database names are interpolated into SQL below, so the pattern also
// keeps them safe to quote.
export function assertTestDatabaseUrl(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^\w+_test$/.test(name)) {
    throw new Error(
      `Refusing to use database "${name}" for tests: the name must end in "_test". ` +
        'Check DATABASE_URL in apps/api/.env.test.',
    );
  }
  return name;
}

async function withConnection<T>(
  url: string,
  run: (db: Awaited<ReturnType<PrismaPg['connect']>>) => Promise<T>,
): Promise<T> {
  const db = await new PrismaPg({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  }).connect();
  try {
    return await run(db);
  } finally {
    await db.dispose();
  }
}

export async function prepareTestDatabase(url: string): Promise<void> {
  const name = assertTestDatabaseUrl(url);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  await withConnection(adminUrl.toString(), async (db) => {
    const existing = await db.queryRaw({
      sql: `SELECT 1 FROM pg_database WHERE datname = '${name}'`,
      args: [],
      argTypes: [],
    });
    if (existing.rows.length === 0) {
      await db.executeRaw({
        sql: `CREATE DATABASE "${name}"`,
        args: [],
        argTypes: [],
      });
    }
  });

  const prisma = createRequire(import.meta.url).resolve(
    'prisma/build/index.js',
  );
  const result = spawnSync(process.execPath, [prisma, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('prisma migrate deploy failed on the test database');
  }
}

export async function truncateAppTables(url: string): Promise<void> {
  assertTestDatabaseUrl(url);
  await withConnection(url, async (db) => {
    const tables = await db.queryRaw({
      sql: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
      args: [],
      argTypes: [],
    });
    if (tables.rows.length === 0) return;
    const list = tables.rows
      .map(([table]) => `"public"."${String(table).replaceAll('"', '""')}"`)
      .join(', ');
    await db.executeRaw({
      sql: `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
      args: [],
      argTypes: [],
    });
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await prepareTestDatabase(readTestDatabaseUrl());
}
