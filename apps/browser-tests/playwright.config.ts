import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { API_ENV, API_URL, WEB_PORT, WEB_URL } from './browser-env.js';

const CI = Boolean(process.env['CI']);

const WEB_ROOT = fileURLToPath(new URL('../web/', import.meta.url));

// Runs against production builds: the api's dist and web's vite build,
// served by vite preview, which proxies /api like the dev server does. Run
// through `pnpm test:browser` from the repo root, which builds both first.
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  // A test that only passes on its retry still fails the run on CI, so a
  // timing flake cannot hide behind a green check.
  retries: CI ? 1 : 0,
  failOnFlakyTests: CI,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  // Never reused: a server already on these ports would not have the short
  // access TTL or the fresh database these tests rely on.
  webServer: [
    {
      command: 'node server/start-api.ts',
      url: `${API_URL}/health/ready`,
      env: API_ENV,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      cwd: WEB_ROOT,
      url: WEB_URL,
      env: { API_PROXY_TARGET: API_URL },
      reuseExistingServer: false,
    },
  ],
});
