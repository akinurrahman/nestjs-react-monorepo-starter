import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage, isApiError } from '@/lib/api/api-error';
import { isErrorHandled } from './handled-errors';

const MAX_RETRIES = 2;

function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
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
        if (query.state.data === undefined || !isApiError(error)) return;
        const message = getErrorMessage(error);
        toast.error(message, { id: `query-refetch:${message}` });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError) return;
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
