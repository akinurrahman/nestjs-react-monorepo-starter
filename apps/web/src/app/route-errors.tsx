import { RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/chunk-error';
import { EmptyState, ErrorState, NotFoundState } from '@/systems/ui';

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim();
  }
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

// Sits on the pathless route inside the layout, so a page that throws is
// replaced and the shell around it stays usable.
export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isChunkLoadError(error)) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="A new version is available"
        description="This page could not load, most likely because the app was updated. Reload to get the latest version."
        action={
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.location.reload()}
          >
            <RefreshCw />
            Reload
          </Button>
        }
      />
    );
  }

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundState />;
  }

  return (
    <div>
      <ErrorState title="This page could not be shown" error={error} />
      {import.meta.env.DEV ? (
        <pre className="mx-auto max-w-3xl overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground"
        >
          {describeError(error)}
        </pre>
      ) : null}
    </div>
  );
}

// Last resort, for errors in the layout itself.
export function RootErrorBoundary() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <RouteErrorBoundary />
    </main>
  );
}
