import { CloudOff, Loader2, RotateCcw } from 'lucide-react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Button } from '@/components/ui/button';
import { useSessionBootstrap } from '@/features/auth';

// Holds the router back until the startup refresh has answered, so a signed-in
// person never sees the login page flash before their session is restored.
// When it gets no answer, the person may still have a valid session, so they
// get a retry rather than the login page.
export function SessionGate({ router }: { router: DataRouter }) {
  const { status, retry } = useSessionBootstrap();

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

  if (status === 'unreachable') {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4">
        <div
          role="alert"
          className="flex max-w-sm flex-col items-center gap-2 text-center"
        >
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <CloudOff
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </span>
          <h1 className="text-sm font-medium text-foreground">
            Can&apos;t reach the server
          </h1>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button type="button" className="mt-2" onClick={retry}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </main>
    );
  }

  return <RouterProvider router={router} />;
}
