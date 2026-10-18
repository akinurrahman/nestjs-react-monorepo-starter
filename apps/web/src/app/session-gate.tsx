import {
  Clock,
  CloudOff,
  Loader2,
  RotateCcw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Button } from '@/components/ui/button';
import { useSessionBootstrap } from '@/features/auth';
import { formatWait, isApiError, isUnreachable } from '@/lib/api/api-error';

type Explanation = { icon: LucideIcon; title: string; description: string };

// Only an unreachable server is worth checking the connection for. A 429 or
// a 5xx is an answer, and says when to try again or that the fault is ours.
function explain(error: unknown): Explanation {
  if (!isApiError(error) || isUnreachable(error)) {
    return {
      icon: CloudOff,
      title: "Can't reach the server",
      description: 'Check your connection and try again.',
    };
  }
  if (error.status === 429) {
    return {
      icon: Clock,
      title: 'Too many requests',
      description:
        error.retryAfter === undefined
          ? 'Wait a moment, then try again.'
          : `Try again in ${formatWait(error.retryAfter)}.`,
    };
  }
  return {
    icon: TriangleAlert,
    title: 'The server ran into a problem',
    description: 'Try again in a moment.',
  };
}

// Holds the router back until the startup refresh has answered, so a signed-in
// person never sees the login page flash before their session is restored.
// When it gets no answer, the person may still have a valid session, so they
// get a retry rather than the login page.
export function SessionGate({ router }: { router: DataRouter }) {
  const { status, error, retry } = useSessionBootstrap();

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
    const { icon: Icon, title, description } = explain(error);
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4">
        <div
          role="alert"
          className="flex max-w-sm flex-col items-center gap-2 text-center"
        >
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
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
