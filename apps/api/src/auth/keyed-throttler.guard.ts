import type { ThrottlerOptions } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

// A route's own rate limit, keyed on something other than the IP, on top of
// the global per-IP limit. Goes on the route with @UseGuards, so it runs
// after the global guards: AuthGuard has set req.user by then.
//
// Never use @Throttle({ default: ... }) for this: it overrides the global
// throttler's limit and tracker on that route, so the per-IP limit is gone.
// This guard keeps its own throttler list instead, and prefixes its tracker
// so its storage key can never equal the global guard's. Its throttler is
// also named `default`, for the plain Retry-After header, so @SkipThrottle()
// or @Throttle() on the same route would change this limit as well.
export abstract class KeyedThrottlerGuard extends ThrottlerGuard {
  protected abstract readonly prefix: string;
  protected abstract readonly rateLimit: Pick<
    ThrottlerOptions,
    'limit' | 'ttl'
  >;
  protected abstract track(req: Request): string;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = [
      {
        name: 'default',
        ...this.rateLimit,
        getTracker: (req) => `${this.prefix}:${this.track(req as Request)}`,
      },
    ];
  }
}
