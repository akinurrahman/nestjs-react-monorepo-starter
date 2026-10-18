import { House, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/chunk-error';
import { isUnexpectedError, reportError } from '@/lib/reporting/report-error';
import { EmptyState, ErrorState, NotFoundState } from '@/systems/ui';

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim();
  }
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

function ReloadButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.location.reload()}
    >
      <RefreshCw />
      Reload
    </Button>
  );
}

// Sits on the pathless route inside the layout, so a page that throws is
// replaced and the shell around it stays usable.
export function RouteErrorBoundary() {
  const error = useRouteError();

  // A thrown response (the 404s) is routing, and a stale chunk is a deploy,
  // not a bug. RootErrorBoundary renders this one, so each error is reported
  // once whichever boundary caught it.
  useEffect(() => {
    if (isRouteErrorResponse(error) || isChunkLoadError(error)) return;
    if (isUnexpectedError(error)) reportError(error, { source: 'render' });
  }, [error]);

  if (isChunkLoadError(error)) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="A new version is available"
        description="This page could not load, most likely because the app was updated. Reload to get the latest version."
        action={<ReloadButton />}
        level={1}
      />
    );
  }

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundState />;
  }

  return (
    <div>
      <ErrorState
        title="This page could not be shown"
        error={error}
        action={
          <>
            <ReloadButton />
            {/* A link, not a Button rendering one: Base UI would give the
                anchor role="button" and hide that it navigates. */}
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              <House />
              Go home
            </Link>
          </>
        }
      />
      {import.meta.env.DEV ? (
        <pre className="mx-auto max-w-3xl overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
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
