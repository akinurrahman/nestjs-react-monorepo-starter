import { Prisma } from '../generated/prisma/client.js';

// These put query data in their message: a validation error prints the call's
// arguments, a raw query error the database's message, which can quote input
// values. Only their code and a few names are logged.
const QUERY_ERRORS = [
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
];

export interface SerializedError {
  type: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: SerializedError;
}

// pino's `err` serializer. It keeps type, message, stack, code and cause
// (serialized the same way) and drops every other field, at any depth: an
// error can carry an HTTP client's config with its headers or a request body,
// which redaction paths cannot follow. Prisma query errors lose their message
// anywhere in the cause chain unless `scrubQueryErrors` is off. pino-http wraps
// the serializer and hands it an already serialized error, whose `raw` is the
// original.
export function createErrorSerializer(
  scrubQueryErrors: boolean,
): (err: unknown) => SerializedError {
  return (err) => {
    const source = (err as { raw?: unknown } | undefined)?.raw ?? err;
    return serialize(source, scrubQueryErrors, new Set());
  };
}

function serialize(
  err: unknown,
  scrubQueryErrors: boolean,
  seen: Set<unknown>,
): SerializedError {
  if (!(err instanceof Error)) {
    return { type: typeof err, message: String(err) };
  }
  if (seen.has(err)) return { type: typeName(err), message: '[Circular]' };
  seen.add(err);

  const scrubbed =
    scrubQueryErrors && QUERY_ERRORS.some((type) => err instanceof type);
  const message = scrubbed ? queryErrorMessage(err) : err.message;
  // The stack starts with the message, so a scrubbed one keeps its frames only.
  const stack = scrubbed ? `${err.name}: ${message}${frames(err)}` : err.stack;
  const { code } = err as { code?: unknown };

  return {
    type: typeName(err),
    message,
    ...(stack !== undefined && { stack }),
    ...((typeof code === 'string' || typeof code === 'number') && { code }),
    ...(err.cause !== undefined && {
      cause: serialize(err.cause, scrubQueryErrors, seen),
    }),
  };
}

function typeName(err: Error): string {
  return typeof err.constructor === 'function'
    ? err.constructor.name
    : err.name;
}

function frames(err: Error): string {
  const stack = err.stack ?? '';
  const framesAt = stack.indexOf('\n    at ');
  return framesAt === -1 ? '' : stack.slice(framesAt);
}

// Names only, never values: the code, the model, the target fields and the
// database's error code and kind.
function queryErrorMessage(err: Error): string {
  const { code, meta } = err as { code?: unknown; meta?: unknown };
  const record = isRecord(meta) ? meta : {};
  const adapterError = isRecord(record.driverAdapterError)
    ? record.driverAdapterError
    : {};
  const adapterCause = isRecord(adapterError.cause) ? adapterError.cause : {};
  const details = [
    namePart('model', record.modelName),
    namePart('target', record.target),
    namePart('database', adapterCause.originalCode),
    namePart('kind', adapterCause.kind),
  ].filter(Boolean);
  const head = typeof code === 'string' ? code : 'Query error';
  const where = details.length > 0 ? ` [${details.join(', ')}]` : '';
  return `${head}${where} (message not logged: it can contain query data)`;
}

function namePart(label: string, value: unknown): string | undefined {
  if (typeof value === 'string') return `${label} ${value}`;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return `${label} ${value.join(',')}`;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
