import { z } from 'zod';

export const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];

// Browsers send `Origin` as scheme://host[:port], lower-case and without a
// default port or trailing slash; requiring that exact form keeps the CORS
// match exact. The URL parser accepts `*` in a host, so wildcards are
// rejected explicitly.
function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value &&
      !url.host.includes('*')
    );
  } catch {
    return false;
  }
}

const corsOrigins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(isOrigin, {
          error:
            'Expected an origin like https://app.example.com (no path, no trailing slash, no wildcard)',
        }),
      )
      .min(1),
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SWAGGER_ENABLED: z.stringbool().optional(),
    SWAGGER_USER: z.string().min(1).optional(),
    SWAGGER_PASSWORD: z.string().min(1).optional(),
    CORS_ORIGINS: corsOrigins.optional(),
    // Number of reverse proxies in front of the app; unset trusts none, so
    // X-Forwarded-For is ignored.
    TRUST_PROXY: z.coerce.number().int().min(1).optional(),
    // HS256 key for access tokens. No default: a guessable key lets anyone
    // mint tokens. 32 characters is the floor, a random 64 is better.
    JWT_SECRET: z.string().min(32),
    // Lifetimes in seconds.
    AUTH_ACCESS_TTL: z.coerce.number().int().min(1).default(900),
    AUTH_REFRESH_TTL: z.coerce.number().int().min(1).default(604_800),
    // How long the secret replaced by a rotation stays accepted, so that
    // concurrent refreshes from one browser are not taken for token reuse.
    AUTH_REFRESH_GRACE: z.coerce.number().int().min(0).default(30),
    AUTH_COOKIE_NAME: z
      .string()
      .regex(/^[\w-]+$/, { error: 'Letters, digits, "_" and "-" only' })
      .default('refresh_token'),
    // Unset makes the cookie host-only, which is what most setups want.
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
    // Read by the seed script only.
    SEED_ADMIN_EMAIL: z.string().min(1).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(1).optional(),
    SEED_ADMIN_NAME: z.string().min(1).optional(),
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.CORS_ORIGINS !== undefined,
    { error: 'Required in production', path: ['CORS_ORIGINS'] },
  )
  // These defaults depend on NODE_ENV, so they are resolved after it is parsed.
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    CORS_ORIGINS: env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS,
  }))
  // Runs on the resolved SWAGGER_ENABLED. Setting only one credential would
  // silently leave the docs open, so it is an error too.
  .superRefine((env, ctx) => {
    const required =
      (env.NODE_ENV === 'production' && env.SWAGGER_ENABLED) ||
      env.SWAGGER_USER !== undefined ||
      env.SWAGGER_PASSWORD !== undefined;
    if (!required) return;

    for (const key of ['SWAGGER_USER', 'SWAGGER_PASSWORD'] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message:
            'Required when the other Swagger credential is set, or when Swagger is enabled in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    // Thrown rather than printed, so main.ts logs it as one fatal line.
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
