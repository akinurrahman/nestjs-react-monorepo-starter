import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@starter/shared';
import { ForbiddenError, UnauthorizedError } from '../common/errors/index.js';
import { ROLES_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';

// Runs after AuthGuard, so on a route with @Roles() the user is set unless
// the route is also @Public(), which this treats as unauthenticated.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedError();
    if (!roles.includes(user.role)) throw new ForbiddenError();
    return true;
  }
}
