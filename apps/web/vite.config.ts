/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_API_PROXY_TARGET = 'http://localhost:8000';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  // Empty prefix: API_PROXY_TARGET is dev-server config, not VITE_*, so it
  // never reaches the client bundle.
  const env = loadEnv(mode, envDir, '');
  const target = env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.spec.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
