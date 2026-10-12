import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// A refresh token is "<sessionId>.<secret>". The secret is 32 random bytes,
// base64url. Only its SHA-256 is stored: it is high entropy, so a slow hash
// like argon2 would add cost and no protection.

export interface RefreshToken {
  sessionId: string;
  secret: string;
}

const SECRET_BYTES = 32;
// 32 bytes in unpadded base64url.
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// Lower-case, as Postgres prints uuids. Checked before any query: a value
// the uuid column cannot hold would make Prisma throw, which would be a 500.
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function generateRefreshSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

export function formatRefreshToken({
  sessionId,
  secret,
}: RefreshToken): string {
  return `${sessionId}.${secret}`;
}

// Undefined for anything that is not exactly a well-formed token.
export function parseRefreshToken(value: unknown): RefreshToken | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value.split('.');
  if (parts.length !== 2) return undefined;
  const [sessionId, secret] = parts as [string, string];
  if (!SESSION_ID_PATTERN.test(sessionId) || !SECRET_PATTERN.test(secret)) {
    return undefined;
  }
  return { sessionId, secret };
}

export function hashRefreshSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function refreshSecretMatches(
  secret: string,
  storedHash: string | null,
): boolean {
  if (storedHash === null) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const actual = createHash('sha256').update(secret).digest();
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
