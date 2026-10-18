import { envSchema, validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('throws with each failing variable in the message, printing nothing', () => {
    const consoleError = vi.spyOn(console, 'error');

    const call = () =>
      validateEnv({ DATABASE_URL: 'mysql://localhost/db', PORT: 'abc' });

    expect(call).toThrow(/^Invalid environment variables:\n/);
    expect(call).toThrow(/→ at DATABASE_URL/);
    expect(call).toThrow(/→ at PORT/);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

const base = {
  DATABASE_URL: 'postgresql://localhost:5432/unused',
  JWT_SECRET: 'x'.repeat(32),
};

function corsOrigins(env: Record<string, string>) {
  return envSchema.parse({ ...base, ...env }).CORS_ORIGINS;
}

function corsIssue(env: Record<string, string>) {
  const result = envSchema.safeParse({ ...base, ...env });
  expect(result.success).toBe(false);
  return result.error?.issues.find((issue) => issue.path[0] === 'CORS_ORIGINS');
}

describe('CORS_ORIGINS', () => {
  it('defaults to the Vite dev server outside production', () => {
    expect(corsOrigins({ NODE_ENV: 'development' })).toEqual([
      'http://localhost:5173',
    ]);
    expect(corsOrigins({ NODE_ENV: 'test' })).toEqual([
      'http://localhost:5173',
    ]);
  });

  it('is required in production', () => {
    expect(corsIssue({ NODE_ENV: 'production' })?.message).toBe(
      'Required in production',
    );
  });

  it('accepts a list in production', () => {
    expect(
      corsOrigins({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example.com',
      }),
    ).toEqual(['https://app.example.com']);
  });

  it('splits on commas, trims and drops empty entries', () => {
    expect(
      corsOrigins({
        CORS_ORIGINS:
          ' https://app.example.com , http://localhost:3000,,https://admin.example.com:8443 ',
      }),
    ).toEqual([
      'https://app.example.com',
      'http://localhost:3000',
      'https://admin.example.com:8443',
    ]);
  });

  it.each([
    ['a wildcard', '*'],
    ['a wildcard among origins', 'https://app.example.com,*'],
    ['a subdomain wildcard', 'https://*.example.com'],
    ['a trailing slash', 'https://app.example.com/'],
    ['a path', 'https://app.example.com/app'],
    ['a missing scheme', 'app.example.com'],
    ['a non-http scheme', 'ftp://app.example.com'],
    ['an explicit default port', 'https://app.example.com:443'],
    ['an upper-case host', 'https://App.example.com'],
    ['the null origin', 'null'],
  ])('rejects %s', (_, value) => {
    expect(corsIssue({ CORS_ORIGINS: value })).toBeDefined();
  });

  it.each([
    ['empty', ''],
    ['only commas', ' , ,'],
  ])('rejects a value that is %s', (_, value) => {
    expect(corsIssue({ CORS_ORIGINS: value })).toBeDefined();
  });
});

describe('TRUST_PROXY', () => {
  function parse(env: Record<string, string>) {
    return envSchema.safeParse({ ...base, ...env });
  }

  it('is off by default', () => {
    expect(parse({}).data?.TRUST_PROXY).toBeUndefined();
  });

  it('parses a hop count', () => {
    expect(parse({ TRUST_PROXY: '2' }).data?.TRUST_PROXY).toBe(2);
  });

  it.each([
    ['zero', '0'],
    ['empty', ''],
    ['negative', '-1'],
    ['a fraction', '1.5'],
    ['a boolean', 'true'],
    ['an address', '10.0.0.0/8'],
  ])('rejects %s', (_, value) => {
    expect(parse({ TRUST_PROXY: value }).success).toBe(false);
  });
});

describe('auth settings', () => {
  function parse(env: Record<string, string | undefined>) {
    return envSchema.safeParse({ ...base, ...env });
  }

  it('requires JWT_SECRET', () => {
    const result = parse({ JWT_SECRET: undefined });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'JWT_SECRET',
    ]);
  });

  it('rejects a JWT_SECRET under 32 characters', () => {
    expect(parse({ JWT_SECRET: 'x'.repeat(31) }).success).toBe(false);
  });

  it('applies the defaults', () => {
    const env = parse({}).data;
    expect(env).toMatchObject({
      AUTH_ACCESS_TTL: 900,
      AUTH_REFRESH_TTL: 604_800,
      AUTH_REFRESH_GRACE: 30,
      AUTH_COOKIE_NAME: 'refresh_token',
    });
    expect(env?.AUTH_COOKIE_DOMAIN).toBeUndefined();
  });

  it('parses lifetimes in seconds', () => {
    expect(
      parse({ AUTH_ACCESS_TTL: '60', AUTH_REFRESH_GRACE: '0' }).data,
    ).toMatchObject({ AUTH_ACCESS_TTL: 60, AUTH_REFRESH_GRACE: 0 });
  });

  it.each([
    [
      'an access TTL equal to the refresh TTL',
      { AUTH_ACCESS_TTL: '600', AUTH_REFRESH_TTL: '600' },
      'AUTH_ACCESS_TTL',
    ],
    [
      'an access TTL longer than the refresh TTL',
      { AUTH_ACCESS_TTL: '900', AUTH_REFRESH_TTL: '600' },
      'AUTH_ACCESS_TTL',
    ],
    [
      'a grace longer than the access TTL',
      { AUTH_ACCESS_TTL: '60', AUTH_REFRESH_GRACE: '61' },
      'AUTH_REFRESH_GRACE',
    ],
  ])('rejects %s', (_, env, key) => {
    const result = parse(env);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([key]);
  });

  it('accepts a grace equal to the access TTL', () => {
    expect(
      parse({ AUTH_ACCESS_TTL: '60', AUTH_REFRESH_GRACE: '60' }).success,
    ).toBe(true);
  });

  it.each([
    ['a zero access TTL', { AUTH_ACCESS_TTL: '0' }],
    ['a fractional refresh TTL', { AUTH_REFRESH_TTL: '1.5' }],
    ['a negative grace', { AUTH_REFRESH_GRACE: '-1' }],
    ['a cookie name with a space', { AUTH_COOKIE_NAME: 'refresh token' }],
    ['a cookie name with a semicolon', { AUTH_COOKIE_NAME: 'a;b' }],
  ])('rejects %s', (_, env) => {
    expect(parse(env).success).toBe(false);
  });
});

describe('SWAGGER_USER / SWAGGER_PASSWORD', () => {
  const PROD = { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' };
  const PASSWORD = 'p'.repeat(16);
  const CREDENTIALS = { SWAGGER_USER: 'docs', SWAGGER_PASSWORD: PASSWORD };

  function issuePaths(env: Record<string, string>) {
    const result = envSchema.safeParse({ ...base, ...env });
    return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
  }

  it('are optional outside production', () => {
    expect(issuePaths({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('are not needed in production while the docs are off', () => {
    expect(issuePaths(PROD)).toEqual([]);
    expect(issuePaths({ ...PROD, SWAGGER_ENABLED: 'false' })).toEqual([]);
  });

  it('are both required when the docs are on in production', () => {
    expect(issuePaths({ ...PROD, SWAGGER_ENABLED: 'true' })).toEqual([
      'SWAGGER_USER',
      'SWAGGER_PASSWORD',
    ]);
  });

  it('are accepted when the docs are on in production', () => {
    expect(
      issuePaths({ ...PROD, SWAGGER_ENABLED: 'true', ...CREDENTIALS }),
    ).toEqual([]);
  });

  it('must be set together', () => {
    expect(issuePaths({ SWAGGER_USER: 'docs' })).toEqual(['SWAGGER_PASSWORD']);
    expect(issuePaths({ SWAGGER_PASSWORD: PASSWORD })).toEqual([
      'SWAGGER_USER',
    ]);
  });

  it('rejects empty values', () => {
    expect(
      issuePaths({ SWAGGER_USER: '', SWAGGER_PASSWORD: PASSWORD }),
    ).toContain('SWAGGER_USER');
  });

  // The docs login has no rate limit, so the password must resist guessing.
  it('requires a password of at least 16 characters', () => {
    const result = envSchema.safeParse({
      ...base,
      ...CREDENTIALS,
      SWAGGER_PASSWORD: 'p'.repeat(15),
    });
    expect(
      result.error?.issues.find((i) => i.path[0] === 'SWAGGER_PASSWORD')
        ?.message,
    ).toMatch(/at least 16 characters/);
    expect(issuePaths(CREDENTIALS)).toEqual([]);
  });
});
