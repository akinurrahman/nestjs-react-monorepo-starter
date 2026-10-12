import {
  formatRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  refreshSecretMatches,
} from './refresh-token.js';

const SESSION_ID = '019a1b2c-3d4e-7f00-8a00-0123456789ab';

describe('generateRefreshSecret', () => {
  it('makes 32 random bytes in base64url', () => {
    const secret = generateRefreshSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
  });

  it('never repeats', () => {
    expect(generateRefreshSecret()).not.toBe(generateRefreshSecret());
  });
});

describe('parseRefreshToken', () => {
  it('round-trips a formatted token', () => {
    const token = { sessionId: SESSION_ID, secret: generateRefreshSecret() };
    expect(parseRefreshToken(formatRefreshToken(token))).toEqual(token);
  });

  const secret = 'a'.repeat(43);

  it.each([
    ['undefined', undefined],
    ['a number', 42],
    ['an empty string', ''],
    ['no separator', `${SESSION_ID}${secret}`],
    ['an extra part', `${SESSION_ID}.${secret}.x`],
    ['an empty secret', `${SESSION_ID}.`],
    ['an empty session id', `.${secret}`],
    ['a session id that is not a uuid', `not-a-uuid.${secret}`],
    ['an upper-case session id', `${SESSION_ID.toUpperCase()}.${secret}`],
    ['a short secret', `${SESSION_ID}.${'a'.repeat(42)}`],
    ['a long secret', `${SESSION_ID}.${'a'.repeat(44)}`],
    ['a secret with padding', `${SESSION_ID}.${'a'.repeat(42)}=`],
    ['a secret in standard base64', `${SESSION_ID}.${'a'.repeat(42)}+`],
    ['SQL in the session id', `'; DROP TABLE sessions; --.${secret}`],
  ])('rejects %s', (_, value) => {
    expect(parseRefreshToken(value)).toBeUndefined();
  });
});

describe('refreshSecretMatches', () => {
  const secret = generateRefreshSecret();
  const hash = hashRefreshSecret(secret);

  it('stores a SHA-256, not the secret', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(secret);
  });

  it('matches the secret the hash was made from', () => {
    expect(refreshSecretMatches(secret, hash)).toBe(true);
  });

  it('does not match another secret', () => {
    expect(refreshSecretMatches(generateRefreshSecret(), hash)).toBe(false);
  });

  it('does not match when nothing is stored', () => {
    expect(refreshSecretMatches(secret, null)).toBe(false);
  });

  it('does not throw on a stored value of the wrong length', () => {
    expect(refreshSecretMatches(secret, 'abcd')).toBe(false);
  });
});
