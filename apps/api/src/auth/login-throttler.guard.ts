import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { LOGIN_RATE_LIMIT, loginTracker } from '../config/throttler.config.js';
import { KeyedThrottlerGuard } from './keyed-throttler.guard.js';

// Per IP and email. The global per-IP limit still applies on top, so trying
// one password against many emails from one IP is limited too.
@Injectable()
export class LoginThrottlerGuard extends KeyedThrottlerGuard {
  protected readonly prefix = 'login';
  protected readonly rateLimit = LOGIN_RATE_LIMIT;

  protected track(req: Request): string {
    return loginTracker(req);
  }
}
