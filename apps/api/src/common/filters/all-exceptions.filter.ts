import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES, type ErrorResponse } from '@starter/shared';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../errors/index.js';
import {
  type ErrorReportContext,
  reportError,
} from '../reporting/report-error.js';

const INTERNAL_ERROR: ErrorResponse = {
  statusCode: 500,
  code: ERROR_CODES.INTERNAL_ERROR,
  message: 'Internal server error',
};

const DEFAULT_ERRORS: Record<number, () => AppError> = {
  400: () => new BadRequestError(),
  401: () => new UnauthorizedError(),
  403: () => new ForbiddenError(),
  404: () => new NotFoundError(),
  409: () => new ConflictError(),
  // ThrottlerException lands here; the guard has already set Retry-After.
  429: () => new TooManyRequestsError(),
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const body = toErrorResponse(exception);

    if (body.statusCode >= 500) {
      const req = http.getRequest<Request>();
      this.logError(exception, body, req);
      reportError(exception, reportContext(req));
    }

    http.getResponse<Response>().status(body.statusCode).json(body);
  }

  // The Error goes under `err` so pino serializes it, `cause` chain included.
  // The message is the public one: pino would otherwise copy the raw error
  // message, which the serializer cannot scrub. req.log is the request's
  // logger, set before body parsing, so parser errors carry the request ID
  // too; without it (no HTTP logger mounted) the module logger is used.
  private logError(
    exception: unknown,
    body: ErrorResponse,
    req: Request,
  ): void {
    const log = req.log as Request['log'] | undefined;
    if (log) {
      log.error(
        { context: AllExceptionsFilter.name, err: exception },
        body.message,
      );
    } else {
      this.logger.error({ err: exception }, body.message);
    }
  }
}

// Picked field by field, so nothing else from the request (body, query,
// headers) can reach a reporter. `route` is unset when no route matched.
function reportContext(req: Request): ErrorReportContext {
  const route = (req.route as { path?: unknown } | undefined)?.path;
  return {
    // genReqId always makes a string; pino-http only types it wider.
    ...(typeof req.id === 'string' && { requestId: req.id }),
    ...(typeof req.method === 'string' && { method: req.method }),
    ...(typeof route === 'string' && { route }),
  };
}

export function toErrorResponse(exception: unknown): ErrorResponse {
  if (exception instanceof AppError) {
    return {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
      ...(exception.errors && { errors: exception.errors }),
    };
  }

  // Must come before HttpException: ZodValidationException extends BadRequestException.
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Validation failed',
      errors:
        zodError instanceof ZodError
          ? zodError.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
              code: issue.code,
            }))
          : [],
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    // 22021: a NUL byte in text, which Postgres rejects. The request schemas
    // refuse it first; this covers a field they miss.
    if (postgresCode(exception) === '22021') {
      return {
        statusCode: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Request contains a character that is not allowed',
      };
    }
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
          message: 'Resource already exists',
        };
      case 'P2025':
        return {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: 'Resource not found',
        };
      default:
        return INTERNAL_ERROR;
    }
  }

  // Raw HttpExceptions come from the framework or a library, never our code,
  // so their messages are never passed through.
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status === 500) return INTERNAL_ERROR;
    return genericResponse(status);
  }

  // Express middleware (body-parser: 413, 415, ...) throws http-errors: plain
  // Errors with a 4xx `status` and `expose: true`. Only the status is used.
  const clientStatus = clientErrorStatus(exception);
  if (clientStatus !== undefined) return genericResponse(clientStatus);

  return INTERNAL_ERROR;
}

// The pg driver adapter reports the database's own SQLSTATE in meta.
function postgresCode(
  exception: Prisma.PrismaClientKnownRequestError,
): string | undefined {
  const adapterError = exception.meta?.['driverAdapterError'] as
    { cause?: { originalCode?: unknown } } | undefined;
  const code = adapterError?.cause?.originalCode;
  return typeof code === 'string' ? code : undefined;
}

function clientErrorStatus(exception: unknown): number | undefined {
  if (!(exception instanceof Error)) return undefined;
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
    ? status
    : undefined;
}

function genericResponse(status: number): ErrorResponse {
  return {
    statusCode: status,
    code: codeFor(status),
    message: genericMessage(status),
  };
}

function codeFor(status: number): string {
  const name: unknown = HttpStatus[status];
  return typeof name === 'string' ? name : `HTTP_${status}`;
}

function genericMessage(status: number): string {
  const domainDefault = DEFAULT_ERRORS[status];
  if (domainDefault) return domainDefault().message;
  const words = codeFor(status).toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
