import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Hashes are stored in the PHC string format argon2 libraries share:
//   $argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<hash>
// The parameters travel with each hash, so they can be raised later without
// breaking verification of hashes made with the old ones.

export interface Argon2Params {
  memory: number;
  passes: number;
  parallelism: number;
}

// OWASP's minimum for argon2id (19 MiB, 2 passes, 1 lane).
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  memory: 19_456,
  passes: 2,
  parallelism: 1,
};

const ALGORITHM = 'argon2id';
// Node implements Argon2 version 1.3 (0x13) only.
const VERSION = 19;
const SALT_BYTES = 16;
const TAG_BYTES = 32;

const argon2Async = promisify(argon2);

// PHC uses standard base64 without padding.
function encode(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

function derive(
  password: string,
  salt: Buffer,
  params: Argon2Params,
  tagLength: number,
): Promise<Buffer> {
  return argon2Async(ALGORITHM, {
    message: password,
    nonce: salt,
    tagLength,
    ...params,
  });
}

export async function hashPassword(
  password: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, params, TAG_BYTES);
  const { memory: m, passes: t, parallelism: p } = params;
  return `$${ALGORITHM}$v=${VERSION}$m=${m},t=${t},p=${p}$${encode(salt)}$${encode(hash)}`;
}

interface ParsedHash {
  params: Argon2Params;
  salt: Buffer;
  hash: Buffer;
}

const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=(\d{1,10}),t=(\d{1,10}),p=(\d{1,8})\$([A-Za-z0-9+/]{11,})\$([A-Za-z0-9+/]{11,})$/;

function parseHash(stored: string): ParsedHash | undefined {
  const match = PHC_PATTERN.exec(stored);
  if (!match) return undefined;
  const [, m, t, p, salt, hash] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    params: { memory: Number(m), passes: Number(t), parallelism: Number(p) },
    salt: Buffer.from(salt, 'base64'),
    hash: Buffer.from(hash, 'base64'),
  };
}

// False for a wrong password and for a stored value that is not an argon2id
// hash this code can read; it never throws on bad input.
export async function verifyPassword(
  stored: string,
  password: string,
): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  let actual: Buffer;
  try {
    actual = await derive(
      password,
      parsed.salt,
      parsed.params,
      parsed.hash.length,
    );
  } catch {
    // Parameters argon2 rejects (e.g. memory below 8 * parallelism).
    return false;
  }
  return timingSafeEqual(actual, parsed.hash);
}
