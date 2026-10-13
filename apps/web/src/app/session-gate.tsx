import { Loader2 } from 'lucide-react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useSessionBootstrap } from '@/features/auth';

// Holds the router back until the startup refresh has answered, so a signed-in
// person never sees the login page flash before their session is restored.
export function SessionGate({ router }: { router: DataRouter }) {
  const status = useSessionBootstrap();

  if (status === 'checking') {
    return (
      <output
        aria-label="Checking your session"
        className="flex min-h-svh items-center justify-center bg-background"
      >
        <Loader2
          aria-hidden="true"
          className="size-6 animate-spin text-muted-foreground"
        />
      </output>
    );
  }

  return <RouterProvider router={router} />;
}
