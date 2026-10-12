// Codes the api sends by name. The filter also derives codes from the HTTP
// status name for framework errors (PAYLOAD_TOO_LARGE, ...), and services may
// use their own (USER_NOT_FOUND), so `code` on the wire stays a plain string.
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  // Login failed. One code for a wrong email, a wrong password and an
  // inactive account, so the response does not reveal which.
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // The refresh cookie is missing, malformed, revoked, expired or reused, or
  // its user is inactive. The client has to log in again.
  INVALID_SESSION: 'INVALID_SESSION',
  // Changing your own password with a wrong current one. A field error on
  // currentPassword, not a 401: the caller is authenticated.
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
