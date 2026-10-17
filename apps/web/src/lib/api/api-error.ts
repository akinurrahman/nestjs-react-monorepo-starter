import {
  errorResponseSchema,
  type ErrorCode,
  type FieldError,
} from '@starter/shared';
import { isAxiosError, isCancel } from 'axios';

export const CLIENT_ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  BAD_RESPONSE: 'BAD_RESPONSE',
} as const;

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

type ApiErrorInit = {
  status: number;
  code: ErrorCode | ClientErrorCode | (string & {});
  message: string;
  fieldErrors?: FieldError[];
  // Seconds, from the Retry-After header. The api sends it with a 429.
  retryAfter?: number;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorInit['code'];
  readonly fieldErrors: FieldError[];
  readonly retryAfter: number | undefined;

  constructor({
    status,
    code,
    message,
    fieldErrors = [],
    retryAfter,
    cause,
  }: ApiErrorInit) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }
}

// Retry-After is either delta seconds or an HTTP date (RFC 9110).
function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const seconds = /^\d+$/.test(trimmed)
    ? Number(trimmed)
    : Math.ceil((Date.parse(trimmed) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function badResponse(status: number, cause?: unknown): ApiError {
  return new ApiError({
    status,
    code: CLIENT_ERROR_CODES.BAD_RESPONSE,
    message: 'Unexpected response from the server',
    cause,
  });
}

// Cancellations are returned as they are: React Query and callers that abort
// on purpose must still recognise them, and they are not failures to report.
export function toApiError(error: unknown): unknown {
  if (isCancel(error) || !isAxiosError(error)) return error;

  const { response } = error;
  if (!response) {
    return new ApiError({
      status: 0,
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
      message: 'Network error',
      cause: error,
    });
  }

  const body = errorResponseSchema.safeParse(response.data);
  if (!body.success) return badResponse(response.status, error);

  return new ApiError({
    status: response.status,
    code: body.data.code,
    message: body.data.message,
    fieldErrors: body.data.errors,
    retryAfter: parseRetryAfter(response.headers['retry-after']),
    cause: error,
  });
}

const MESSAGES = {
  network: 'Could not reach the server. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

function formatWait(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? '1 second' : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

// In production a reverse proxy answers these while the api is down, and the
// api's own 503 (database down) leaves the person just as stuck.
const UNREACHABLE_STATUSES = new Set([502, 503, 504]);

export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return MESSAGES.unknown;
  if (
    error.code === CLIENT_ERROR_CODES.NETWORK_ERROR ||
    UNREACHABLE_STATUSES.has(error.status)
  ) {
    return MESSAGES.network;
  }
  if (error.code === CLIENT_ERROR_CODES.BAD_RESPONSE) return MESSAGES.server;
  if (error.status === 429 && error.retryAfter !== undefined) {
    return `Too many requests. Try again in ${formatWait(error.retryAfter)}.`;
  }
  if (error.status >= 400 && error.status < 500) return error.message;
  return MESSAGES.server;
}
