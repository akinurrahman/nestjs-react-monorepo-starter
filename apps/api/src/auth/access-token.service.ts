import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { roleSchema } from '@starter/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { Env } from '../config/env.schema.js';
import type { AuthUser } from './auth.types.js';

const ALGORITHM = 'HS256';

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  role: roleSchema,
});

// Access tokens are verified from the signature alone, with no database
// read. The accepted tradeoff: one stays valid until it expires, even after
// logout revokes its session.
@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    this.key = new TextEncoder().encode(
      config.get('JWT_SECRET', { infer: true }),
    );
    this.ttlSeconds = config.get('AUTH_ACCESS_TTL', { infer: true });
  }

  sign(user: AuthUser): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: user.sessionId, role: user.role })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttlSeconds)
      .sign(this.key);
  }

  // Undefined for any token that does not verify: bad signature, another
  // algorithm, expired, or claims of the wrong shape.
  async verify(token: string): Promise<AuthUser | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        requiredClaims: ['exp'],
      });
      const claims = claimsSchema.parse(payload);
      return { id: claims.sub, sessionId: claims.sid, role: claims.role };
    } catch {
      return undefined;
    }
  }
}
