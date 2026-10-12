import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../common/errors/index.js';
import { PASSWORD_CHANGE_RATE_LIMIT } from '../config/throttler.config.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { KeyedThrottlerGuard } from './keyed-throttler.guard.js';

// Per user, so colleagues behind one IP do not share a bucket.
@Injectable()
export class PasswordChangeThrottlerGuard extends KeyedThrottlerGuard {
  protected readonly prefix = 'user';
  protected readonly rateLimit = PASSWORD_CHANGE_RATE_LIMIT;

  protected track(req: Request): string {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw new UnauthorizedError();
    return user.id;
  }
}
