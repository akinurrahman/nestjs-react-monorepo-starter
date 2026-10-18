import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .union([
      z.literal(''),
      z.url({
        protocol: /^https?$/,
        error: 'Must be empty (same origin) or an http(s) URL',
      }),
    ])
    // lib/api appends /api, which a trailing slash would turn into //api.
    .transform((url) => url.replace(/\/+$/, ''))
    .default(''),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export const env = parseEnv(import.meta.env);
