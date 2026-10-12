import { ERROR_CODES, type FieldError } from '@starter/shared';
import { AppError } from './app-error.js';

// `errors` are sent to the client as field errors. `cause` is logged by
// AllExceptionsFilter (for 5xx) but never sent.
export interface HttpErrorOptions extends ErrorOptions {
  errors?: FieldError[];
}

export class BadRequestError extends AppError {
  constructor(
    code: string = ERROR_CODES.BAD_REQUEST,
    message = 'Bad request',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(400, code, message, errors, options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    code: string = ERROR_CODES.UNAUTHORIZED,
    message = 'Authentication required',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(401, code, message, errors, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    code: string = ERROR_CODES.FORBIDDEN,
    message = 'Access denied',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(403, code, message, errors, options);
  }
}

export class NotFoundError extends AppError {
  constructor(
    code: string = ERROR_CODES.NOT_FOUND,
    message = 'Resource not found',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(404, code, message, errors, options);
  }
}

export class ConflictError extends AppError {
  constructor(
    code: string = ERROR_CODES.CONFLICT,
    message = 'Resource already exists',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(409, code, message, errors, options);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    code: string = ERROR_CODES.TOO_MANY_REQUESTS,
    message = 'Too many requests, try again later',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(429, code, message, errors, options);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    code: string = ERROR_CODES.SERVICE_UNAVAILABLE,
    message = 'Service unavailable',
    { errors, ...options }: HttpErrorOptions = {},
  ) {
    super(503, code, message, errors, options);
  }
}
