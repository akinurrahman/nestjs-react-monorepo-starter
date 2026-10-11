import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import type { StoreApi } from 'zustand';
import { usePaletteStore } from '@/app/shell/palette-store';
import { useSidebarStore } from '@/components/ui/sidebar-store';
import { useConfirmationStore } from '@/systems/confirmation/confirmation-store';
import { useSessionStore } from '@/systems/session/session-store';
import { useThemeStore } from '@/systems/theme/theme-store';
import { installMatchMedia } from './match-media';
import { server } from './msw-server';

const unhandledRequests: string[] = [];

function resetStore<T>(store: StoreApi<T>) {
  store.setState(store.getInitialState(), true);
}

// A fresh viewport and color scheme, and fresh stores, per test. The stores
// reset first: the persisted ones write their defaults back to storage,
// which the clear then empties.
beforeEach(() => {
  installMatchMedia();
  resetStore(useSessionStore);
  resetStore(useThemeStore);
  resetStore(useSidebarStore);
  resetStore(usePaletteStore);
  resetStore(useConfirmationStore);
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
