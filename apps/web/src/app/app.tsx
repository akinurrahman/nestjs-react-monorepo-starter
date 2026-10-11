import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmationHost } from '@/systems/confirmation';

type AppProps = {
  router: DataRouter;
  queryClient: QueryClient;
};

/**
 * QueryClientProvider is outermost, so every route component can use the
 * client. Loaders run outside React, so when one needs it, main.tsx hands
 * this same client to createAppRouter.
 *
 * Toaster and ConfirmationHost are siblings of the router, not inside a
 * route, so a toast or a dialog survives any route error boundary, the root
 * one included. They have no router context: confirm() content must not use
 * Link or other router hooks.
 */
export function App({ router, queryClient }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <ConfirmationHost />
    </QueryClientProvider>
  );
}
