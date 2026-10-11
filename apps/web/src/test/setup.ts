import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { installMatchMedia } from './match-media';
import { server } from './msw-server';

const unhandledRequests: string[] = [];

// A fresh viewport and color scheme, and no persisted stores, per test.
beforeEach(() => {
  installMatchMedia();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      unhandledRequests.push(`${request.method} ${request.url}`);
      print.error();
    },
  });
});

// RTL auto-cleanup depends on detecting a global afterEach at import time.
afterEach(() => {
  cleanup();
  server.resetHandlers();
  // print.error() only fails the request, which a test expecting an error
  // would swallow, so the test itself is failed here.
  const unhandled = unhandledRequests.splice(0);
  if (unhandled.length > 0) {
    throw new Error(`Unhandled requests:\n${unhandled.join('\n')}`);
  }
});

afterAll(() => {
  server.close();
});
