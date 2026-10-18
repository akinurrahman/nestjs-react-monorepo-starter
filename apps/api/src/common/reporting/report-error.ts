// What a report may carry. No body, query or headers: the same rule as the
// logs, never user data. `route` is the matched pattern (/users/:id), not
// the URL, so it holds no ids.
export interface ErrorReportContext {
  requestId?: string;
  method?: string;
  route?: string;
}

// The one place unexpected errors (those answered with a 5xx) are reported.
// AllExceptionsFilter calls it after logging them, so it does nothing by
// default. To add Sentry or similar, call its SDK here.
export function reportError(
  _error: unknown,
  _context: ErrorReportContext,
): void {}
