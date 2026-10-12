import type { ThrottlerOptions } from '@nestjs/throttler';
import type { Request } from 'express';

// Per client IP (`req.ip`, so behind a proxy it depends on TRUST_PROXY).
// Named `default` so the guard sends plain Retry-After / X-RateLimit-*
// headers; any other name is appended to each header.
export const RATE_LIMIT = {
  name: 'default',
  ttl: 60_000,
  limit: 100,
} satisfies ThrottlerOptions;

// Login is throttled per client IP and email together, so guessing one
// account's password is slowed down while an office behind one IP can still
// sign in its other users. RATE_LIMIT still applies on top, which caps one
// password tried against many emails.
export const LOGIN_RATE_LIMIT = {
  limit: 5,
  ttl: 60_000,
} satisfies Pick<ThrottlerOptions, 'limit' | 'ttl'>;

// Changing your own password is limited per user, like login. Keyed on the
// user, so a stolen access token cannot guess the current password faster
// from many IPs, and colleagues behind one IP do not share a bucket.
export const PASSWORD_CHANGE_RATE_LIMIT = {
  limit: 5,
  ttl: 60_000,
} satisfies Pick<ThrottlerOptions, 'limit' | 'ttl'>;

// Guards run before validation, so the email is normalized here the same way
// the login schema does it. A missing or non-string email shares one bucket.
export function loginTracker(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${String(req.ip)}|${email}`;
}
