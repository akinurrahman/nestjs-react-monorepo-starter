import { ERROR_CODES } from '@starter/shared';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage, isApiError } from '@/lib/api/api-error';
import { isUnexpectedError, reportError } from '@/lib/reporting/report-error';
import { isErrorHandled } from './handled-errors';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      // The caller shows this query's errors itself, so a failed refetch
      // does not toast.
      handledError?: boolean;
    };
    mutationMeta: {
      // The caller shows this mutation's errors itself, so the global
      // toast stays quiet.
      handledError?: boolean;
    };
  }
}

const MAX_RETRIES = 2;

function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

// An UNAUTHORIZED that gets this far outlived a failed refresh: the session
// is already cleared and the person is on their way to /login, which says
// more than "Authentication required" would.
function isSessionEnd(error: unknown): boolean {
  return isApiError(error) && error.code === ERROR_CODES.UNAUTHORIZED;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // A first load that fails is the page's ErrorState (isLoadingError).
      // A refetch that fails after its retries keeps the data on screen,
      // so this toast is the only sign it is stale. Only an ApiError is
      // reported: a cancellation is not one, and is not a failure. The id
      // folds identical messages, as when every open query fails at once on
      // a window focus while offline.
      onError: (error, query) => {
        // Before any opt-out: a bug is reported however the page shows it.
        if (isUnexpectedError(error)) reportError(error, { source: 'query' });
        if (query.meta?.handledError || isSessionEnd(error)) return;
        if (query.state.data === undefined || !isApiError(error)) return;
        const message = getErrorMessage(error);
        toast.error(message, { id: `query-refetch:${message}` });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isUnexpectedError(error)) {
          reportError(error, { source: 'mutation' });
        }
        // Only the mutation's own options count. An onError passed to
        // mutate(vars, { onError }) never reaches the cache, so that caller
        // opts out with meta instead.
        if (mutation.options.onError || mutation.meta?.handledError) return;
        if (isSessionEnd(error)) return;
        // This runs before mutateAsync rejects, so a Form awaiting the
        // mutation has not caught and shown the error yet. Its catch runs in
        // the same microtask chain, so one macrotask later it has.
        setTimeout(() => {
          if (!isErrorHandled(error)) toast.error(getErrorMessage(error));
        }, 0);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          !isClientError(error) && failureCount < MAX_RETRIES,
      },
      mutations: { retry: false },
    },
  });
}
