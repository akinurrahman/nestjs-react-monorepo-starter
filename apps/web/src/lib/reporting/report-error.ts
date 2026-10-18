import { isCancel } from 'axios';
import {
  CLIENT_ERROR_CODES,
  isApiError,
  isUnreachable,
} from '@/lib/api/api-error';

// What a report may carry. Never user data: no query key (it can hold search
// text), no variables, no form values. `source` says which catch-all saw it.
export interface ErrorReportContext {
  source: 'render' | 'query' | 'mutation';
}

// A bug in this app, not a failure the person can act on: a thrown error
// that is not an ApiError, or a response that broke the api's contract. An
// ApiError the api sent on purpose (4xx, 5xx) is the api's to report, an
// unreachable server is nobody's bug, and a cancellation is not a failure.
export function isUnexpectedError(error: unknown): boolean {
  if (isCancel(error)) return false;
  if (!isApiError(error)) return true;
  return (
    error.code === CLIENT_ERROR_CODES.BAD_RESPONSE && !isUnreachable(error)
  );
}

// The one place unexpected errors are reported. The route error boundaries
// and the query and mutation caches call it for isUnexpectedError. It logs
// to the console in production builds only: in development React and the
// dev tools already show these errors. To add Sentry or similar, call its
// SDK here.
export function reportError(error: unknown, context: ErrorReportContext): void {
  if (import.meta.env.PROD) console.error(error, context);
}
