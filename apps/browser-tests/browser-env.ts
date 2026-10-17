import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// Everything the browser tests run against: ports, the database and the
// api's environment. All committed: a throwaway database in the docker
// compose Postgres, with its public local credentials, and fake secrets.

// Not the dev ports (8000, 5173), so a running `pnpm dev` never collides.
export const API_PORT = 8010;
export const WEB_PORT = 4173;

export const API_URL = `http://localhost:${API_PORT}`;
// localhost, not 127.0.0.1: the refresh cookie is Secure, and browsers only
// accept that over plain http on localhost.
export const WEB_URL = `http://localhost:${WEB_PORT}`;

// Dropped and recreated on every run. The name must end in _browser: the
// api start script refuses anything else. Separate from starter_test, so
// `pnpm test:e2e` can run alongside.
export const DATABASE_URL = withLocalDbPort(
  'postgresql://postgres:postgres@localhost:5432/starter_browser',
);

// Moves the url to DB_PORT, from the environment or the gitignored root
// .env (where docker compose reads it), when the local Postgres is not on
// 5432. CI has neither, so it keeps 5432. Same rule as the e2e tests'
// apps/api/test/test-db.ts.
function withLocalDbPort(url: string): string {
  const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
  const port =
    process.env['DB_PORT'] ||
    (existsSync(rootEnv)
      ? parseEnv(readFileSync(rootEnv, 'utf8'))['DB_PORT']
      : undefined);
  if (!port) return url;
  if (!/^\d{1,5}$/.test(port)) {
    throw new Error(`DB_PORT must be a port number, got "${port}"`);
  }
  const next = new URL(url);
  next.port = port;
  return next.toString();
}

// Short, so a test can outlive an access token in seconds.
export const ACCESS_TTL_SECONDS = 5;

export type Account = { email: string; password: string; name: string };

// Seeded by the api start script.
export const ADMIN: Account = {
  email: 'admin@browser.test',
  password: 'browser-admin-password',
  name: 'Browser Admin',
};

// Created through the api by the global setup. Tests only read ADMIN and
// USER; projects run side by side, so a test that changes an account gets
// its own (see profileUser).
export const USER: Account = {
  email: 'user@browser.test',
  password: 'browser-user-password',
  name: 'Browser User',
};

// A USER per Playwright project, for the test that renames itself.
export function profileUser(project: string): Account {
  return {
    email: `profile-${project}@browser.test`,
    password: 'browser-profile-password',
    name: `Profile ${project}`,
  };
}

// The whole environment the api and its seed read. They run with the
// browser-tests folder as cwd, which has no .env, so nothing from a
// developer's apps/api/.env leaks in.
export const API_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  PORT: String(API_PORT),
  DATABASE_URL,
  // The tests cause 401s on purpose, which log as warnings. Errors and a
  // failed boot still show.
  LOG_LEVEL: 'error',
  JWT_SECRET: 'browser-tests-only-jwt-secret-not-for-real-use-0123456789',
  AUTH_ACCESS_TTL: String(ACCESS_TTL_SECONDS),
  // At most the access TTL, which the env schema requires.
  AUTH_REFRESH_GRACE: String(ACCESS_TTL_SECONDS),
  CORS_ORIGINS: WEB_URL,
  // vite preview is the one proxy in front of the api. Trusting it lets each
  // test send its own X-Forwarded-For, so every test gets its own rate limit
  // buckets (see tests/fixtures.ts).
  TRUST_PROXY: '1',
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
  SEED_ADMIN_NAME: ADMIN.name,
};
