import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { LOG_LEVEL: 'silent' },
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-file.ts'],
    // Files share one database and each truncates it, so they cannot overlap.
    fileParallelism: false,
  },
});
