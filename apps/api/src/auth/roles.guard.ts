import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@starter/shared';
import { ForbiddenError, UnauthorizedError } from '../common/errors/index.js';
import { ROLES_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SessionsRepository } from './sessions.repository.js';

// Runs after AuthGuard, so on a route with @Roles() the user is set unless
// the route is also @Public(), which this treats as unauthenticated.
//
// The token's role is only what it was at sign-in, so a route with @Roles()
// checks the database: the user must still be active and hold the role, and
// the token's session must be live. A demotion also revokes the sessions, so
// the role is checked first: a demoted admin learns they lost the role (403)
// rather than being signed out. Routes without @Roles() stay on the token.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) throw new UnauthorizedError();

    const access = await this.sessions.findAccess(user.sessionId);
    if (!access || access.userId !== user.id || !access.user.isActive) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(access.user.role)) throw new ForbiddenError();
    if (access.revokedAt !== null || access.expiresAt <= new Date()) {
      throw new UnauthorizedError();
    }

    req.user = { ...user, role: access.user.role };
    return true;
  }
}
