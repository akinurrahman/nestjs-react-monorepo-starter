import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { DataRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmationHost } from '@/systems/confirmation';
import { ThemeSync, useResolvedTheme } from '@/systems/theme';
import { SessionGate } from './session-gate';

type AppProps = {
  router: DataRouter;
  queryClient: QueryClient;
};

// Its own component, so a theme change re-renders the Toaster and not the
// router.
function ThemedToaster() {
  return <Toaster theme={useResolvedTheme()} />;
}

/**
 * QueryClientProvider is outermost, so every route component can use the
 * client. Loaders run outside React, so when one needs it, main.tsx hands
 * this same client to createAppRouter.
 *
 * Toaster and ConfirmationHost are siblings of the router, not inside a
 * route, so a toast or a dialog survives any route error boundary, the root
 * one included. They have no router context: confirm() content must not use
 * Link or other router hooks.
 *
 * ThemeSync keeps the .dark class current after the inline script in
 * index.html has set the first one.
 *
 * SessionGate renders the router once the startup session check is done, and
 * sits inside the client because a failed refresh clears its cache.
 */
export function App({ router, queryClient }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <SessionGate router={router} />
      <ThemedToaster />
      <ConfirmationHost />
    </QueryClientProvider>
  );
}
