import { z } from 'zod';

// Ordered from most to least privileged.
export const ROLES = ['ADMIN', 'USER'] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;
