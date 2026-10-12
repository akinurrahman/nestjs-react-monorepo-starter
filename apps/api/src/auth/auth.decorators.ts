import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import type { Role } from '@starter/shared';
import { UnauthorizedError } from '../common/errors/index.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

// Every route needs an access token unless it is marked public. In the docs,
// an empty security requirement overrides the global bearer one.
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}));

// The caller must have one of these roles. Implies authentication.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// The authenticated caller, as AuthGuard set it. Throws on a public route,
// where there is none: that is a wiring mistake, not a client error, but a
// 401 is the safe answer.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedError();
    return user;
  },
);
