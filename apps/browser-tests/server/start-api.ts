import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';

// Started by Playwright's webServer, with the environment from
// browser-env.ts. Recreates the browser test database, migrates it, seeds
// the admin, then runs the built api in this process, so stopping the web
// server stops the api.
//
// Run by Node's type stripping, so this file imports no relative modules and
// uses erasable syntax only.

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const API_ROOT = fileURLToPath(new URL('../../api/', import.meta.url));

// Database names are interpolated into SQL below, so the pattern also keeps
// them safe to quote.
function browserDatabaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^\w+_browser$/.test(name)) {
    throw new Error(
      `Refusing to use database "${name}" for browser tests: the name must end in "_browser". ` +
        'Check DATABASE_URL in apps/browser-tests/browser-env.ts.',
    );
  }
  return name;
}

async function recreateDatabase(url: string): Promise<void> {
  const name = browserDatabaseName(url);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const db = await new PrismaPg({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  }).connect();
  try {
    // FORCE: an api left over from an aborted run may still be connected.
    for (const sql of [
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
      `CREATE DATABASE "${name}"`,
    ]) {
      await db.executeRaw({ sql, args: [], argTypes: [] });
    }
  } finally {
    await db.dispose();
  }
}

function run(args: string[], cwd: string, what: string): void {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${what} failed`);
}

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is not set');

await recreateDatabase(url);

// From the api folder, where prisma7.config.ts lives. Its dotenv import
// does not override the DATABASE_URL set here.
const prisma = createRequire(`${API_ROOT}package.json`).resolve(
  'prisma/build/index.js',
);
run([prisma, 'migrate', 'deploy'], API_ROOT, 'prisma migrate deploy');

// The seed and the api read .env from the cwd, and this folder has none.
run(
  ['--enable-source-maps', `${API_ROOT}dist/seed.js`],
  PACKAGE_ROOT,
  'Seeding the admin',
);

process.chdir(PACKAGE_ROOT);
await import(pathToFileURL(`${API_ROOT}dist/main.js`).href);
