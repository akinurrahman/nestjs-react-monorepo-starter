import type { Role } from '@starter/shared';
import type { Request } from 'express';

// What the access token proves, set on the request by AuthGuard.
export interface AuthUser {
  id: string;
  sessionId: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Request details stored on the session.
export interface ClientInfo {
  ip: string | undefined;
  userAgent: string | undefined;
}
