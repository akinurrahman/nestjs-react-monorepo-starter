import { z } from 'zod';

// Ordered from most to least privileged. The web dev session stub takes the
// first entry as its default role.
export const ROLES = ['ADMIN', 'USER'] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;
