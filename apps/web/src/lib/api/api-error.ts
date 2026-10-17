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
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorInit['code'];
  readonly fieldErrors: FieldError[];

  constructor({
    status,
    code,
    message,
    fieldErrors = [],
    cause,
  }: ApiErrorInit) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
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
    cause: error,
  });
}

const MESSAGES = {
  network: 'Could not reach the server. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

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
  if (error.status >= 400 && error.status < 500) return error.message;
  return MESSAGES.server;
}
