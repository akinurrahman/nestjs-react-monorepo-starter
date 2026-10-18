import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { DataRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmationHost, resetConfirmation } from '@/systems/confirmation';
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

// A question asked on one page means nothing on the next. The router's own
// subscription, not a hook inside a route, so it still runs when a route
// error boundary has replaced the page. Search-only changes, like a filter,
// keep the dialog.
function useResetConfirmationOnPageChange(router: DataRouter) {
  useEffect(() => {
    let pathname = router.state.location.pathname;
    return router.subscribe((state) => {
      if (state.location.pathname === pathname) return;
      pathname = state.location.pathname;
      resetConfirmation();
    });
  }, [router]);
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
  useResetConfirmationOnPageChange(router);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <SessionGate router={router} />
      <ThemedToaster />
      <ConfirmationHost />
    </QueryClientProvider>
  );
}
