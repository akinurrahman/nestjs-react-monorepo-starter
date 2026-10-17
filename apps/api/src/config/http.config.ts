import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { HttpLogger } from 'pino-http';
import type { Env } from './env.schema.js';
import { HTTP_LOGGER, REQUEST_ID_HEADER } from './logger.config.js';

export const API_PREFIX = 'api';

// Probes are configured against fixed paths, so they stay outside the prefix.
// Exclusions match exactly: each path is listed on its own.
export const UNPREFIXED_PATHS = ['health', 'health/ready'];

// Must run before setupSwagger: the prefix ends up in the documented paths,
// and the logger and helmet must be registered ahead of the docs routes.
export function configureHttp(app: NestExpressApplication): void {
  // First, so every response is logged and carries a request ID, including
  // errors thrown by body parsing, which runs before Nest's own middleware.
  app.use(app.get<HttpLogger>(HTTP_LOGGER));

  const config = app.get(ConfigService<Env, true>);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const allowedOrigins = new Set(corsOrigins);

  // With N hops trusted, req.ip is the address the outermost trusted proxy
  // saw, which is what the throttler keys on. Unset leaves Express's default
  // (trust nothing): X-Forwarded-For is ignored, so clients cannot spoof it.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);

  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_PATHS });
  app.use(helmet());
  app.enableCors({
    // A callback rather than the list itself: when it answers false, `cors`
    // skips the request entirely, so a disallowed origin gets no CORS headers
    // at all (with a list it still sends Access-Control-Allow-Credentials).
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, origin !== undefined && allowedOrigins.has(origin)),
    credentials: true,
    // Retry-After is not CORS-safelisted: without this a web app on another
    // origin cannot read how long a 429 asks it to wait.
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
  });

  // Rejects state-changing requests a browser reports as cross-origin
  // (Sec-Fetch-Site, or Origin against Host), with a 403 through the filter.
  // SameSite=Strict already keeps the refresh cookie off cross-site requests;
  // this also covers same-site ones, such as from a sibling subdomain. The
  // CORS origins are the web apps, so they are trusted here too. After the
  // logger and CORS, so rejections are logged and carry CORS headers.
  app.enableCsrfProtection({ trustedOrigins: corsOrigins });
}
