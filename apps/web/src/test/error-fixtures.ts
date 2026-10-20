import { ERROR_CODES, type ErrorResponse } from '@starter/shared';

export const validationFailed = {
  statusCode: 400,
  code: ERROR_CODES.VALIDATION_FAILED,
  message: 'Validation failed',
  errors: [
    { path: 'email', message: 'Invalid email address', code: 'invalid_format' },
    { path: 'name', message: 'Required', code: 'invalid_type' },
  ],
} satisfies ErrorResponse;

export const notFound = {
  statusCode: 404,
  code: ERROR_CODES.NOT_FOUND,
  message: 'Resource not found',
} satisfies ErrorResponse;

export const domainNotFound = {
  statusCode: 404,
  code: 'THING_NOT_FOUND',
  message: 'Thing not found',
} satisfies ErrorResponse;

export const csrfRejected = {
  statusCode: 403,
  code: ERROR_CODES.CSRF_REJECTED,
  message: 'Cross-site request blocked',
} satisfies ErrorResponse;

export const conflict = {
  statusCode: 409,
  code: ERROR_CODES.CONFLICT,
  message: 'Resource already exists',
} satisfies ErrorResponse;

export const payloadTooLarge = {
  statusCode: 413,
  code: 'PAYLOAD_TOO_LARGE',
  message: 'Payload too large',
} satisfies ErrorResponse;

export const tooManyRequests = {
  statusCode: 429,
  code: ERROR_CODES.TOO_MANY_REQUESTS,
  message: 'Too many requests, try again later',
} satisfies ErrorResponse;

export const internalError = {
  statusCode: 500,
  code: ERROR_CODES.INTERNAL_ERROR,
  message: 'Internal server error',
} satisfies ErrorResponse;
