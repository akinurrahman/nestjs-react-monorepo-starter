import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { request, type FullConfig } from '@playwright/test';
import { ADMIN, API_URL, profileUser, USER } from '../browser-env.js';

// The env files `vite build` reads in production mode.
const WEB_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
];

// The web build bakes VITE_API_BASE_URL in. Set in a local env file, it
// sends every request past vite preview to some other api, and the tests
// fail in confusing ways, so say so up front.
function assertSameOriginWebBuild(): void {
  for (const file of WEB_ENV_FILES) {
    let source: string;
    try {
      source = readFileSync(
        fileURLToPath(new URL(`../../web/${file}`, import.meta.url)),
        'utf8',
      );
    } catch {
      continue;
    }
    if (parseEnv(source)['VITE_API_BASE_URL']) {
      throw new Error(
        `apps/web/${file} sets VITE_API_BASE_URL. The browser tests need a same-origin build: unset it and run again.`,
      );
    }
  }
}

type Envelope<T> = { data: T };

// Runs after the web servers are up. The admin exists already (the api start
// script seeds it); the USERs go through the real create endpoint. These
// requests carry no browser headers, so the CSRF check lets them through.
export default async function globalSetup(config: FullConfig): Promise<void> {
  assertSameOriginWebBuild();

  const api = await request.newContext({ baseURL: API_URL });
  try {
    const login = await api.post('/api/auth/login', {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    if (!login.ok()) {
      throw new Error(`Admin login failed: ${login.status()}`);
    }
    const { data } = (await login.json()) as Envelope<{ accessToken: string }>;

    const users = [
      USER,
      ...config.projects.map((project) => profileUser(project.name)),
    ];
    // In a row, well inside the access token's lifetime.
    for (const user of users) {
      const created = await api.post('/api/users', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
        data: { ...user, role: 'USER' },
      });
      if (created.status() !== 201) {
        throw new Error(
          `Creating ${user.email} failed: ${created.status()} ${await created.text()}`,
        );
      }
    }
  } finally {
    await api.dispose();
  }
}
