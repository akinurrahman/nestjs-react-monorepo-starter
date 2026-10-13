import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../common/errors/index.js';
import { AccessTokenService } from './access-token.service.js';
import { IS_PUBLIC_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';

const BEARER = /^Bearer ([A-Za-z0-9_.-]+)$/;

// Global and deny by default: a route without @Public() needs a valid access
// token. The token alone is trusted, with no database read; RolesGuard
// adds one on routes with @Roles().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
    const user = token && (await this.tokens.verify(token));
    if (!user) throw new UnauthorizedError();

    req.user = user;
    return true;
  }
}
