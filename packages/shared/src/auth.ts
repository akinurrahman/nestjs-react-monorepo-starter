import { z } from 'zod';
import { roleSchema } from './roles.js';

// Trimmed and lower-cased before it is validated, so lookups and the unique
// index only ever see one spelling of an address. 254 is the SMTP limit.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

// Argon2 takes any length; the cap keeps the cost of one attempt bounded.
export const PASSWORD_MAX_LENGTH = 256;

// No minimum length here: the password policy belongs to account creation,
// and changing it must not lock out existing users.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

// The user as the api sends it, everywhere. Never carries the password hash.
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});

export type LoginInput = z.input<typeof loginSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
