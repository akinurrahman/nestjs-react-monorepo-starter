import { Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import { UnauthorizedError } from '../common/errors/index.js';
import { PASSWORD_CHANGE_RATE_LIMIT } from '../config/throttler.config.js';
import type { AuthenticatedRequest } from './auth.types.js';

// Prefixed so the key can never equal the global guard's key for this route,
// which is built the same way from the IP.
const userTracker: ThrottlerGetTrackerFunction = (req) => {
  const user = (req as Partial<AuthenticatedRequest>).user;
  if (!user) throw new UnauthorizedError();
  return `user:${user.id}`;
};

// The global ThrottlerGuard runs before AuthGuard, so it can only key on the
// IP. This one goes on the route with @UseGuards, which runs after the global
// guards, when req.user is set. It replaces the throttler list with its own,
// so the global IP limit on the same route stays as it is.
@Injectable()
export class PasswordChangeThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = [
      {
        name: 'default',
        ...PASSWORD_CHANGE_RATE_LIMIT,
        getTracker: userTracker,
      },
    ];
  }
}
