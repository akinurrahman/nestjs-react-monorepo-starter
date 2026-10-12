import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
});

export const readinessSchema = healthSchema.extend({
  checks: z.object({
    database: z.literal('ok'),
  }),
});

export type Health = z.infer<typeof healthSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
