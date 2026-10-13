import { z } from 'zod';
import { roleSchema } from './roles.js';

// 254 is the SMTP limit.
const EMAIL_MAX_LENGTH = 254;

// Trimmed and lower-cased before it is validated, so lookups and the unique
// index only ever see one spelling of an address.
const normalizedEmail = (required?: string) =>
  z.string({ error: required }).trim().toLowerCase();

// The messages are written for a form, which shows them as they are. An
// empty field stops at "Enter ..." and never reaches the format check.
export const emailSchema = normalizedEmail('Enter an email')
  .min(1, 'Enter an email')
  .max(EMAIL_MAX_LENGTH, 'Enter a valid email')
  .pipe(z.email('Enter a valid email'));

// Argon2 takes any length; the cap keeps the cost of one attempt bounded.
export const PASSWORD_MAX_LENGTH = 256;

export const PASSWORD_MIN_LENGTH = 8;

// The policy for every password that gets set: create, admin reset, change
// and the seed. Kept as is, with no trimming, like at login. abort keeps an
// empty field to the one "Enter" message instead of adding the length one.
export const newPasswordSchema = z
  .string({ error: 'Enter a password' })
  .min(1, { error: 'Enter a password', abort: true })
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  );

// No minimum length here: the policy applies when a password is set, and
// changing it must not lock out existing users.
const currentPasswordSchema = z
  .string({ error: 'Enter your current password' })
  .min(1, 'Enter your current password')
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  );

// The same rules as emailSchema and currentPasswordSchema, with messages
// written for the sign-in form, which shows them as they are. An empty field
// stops at "Enter ..." and never reaches the format check.
export const loginSchema = z.strictObject({
  email: normalizedEmail('Enter your email')
    .min(1, 'Enter your email')
    .max(EMAIL_MAX_LENGTH, 'Enter a valid email')
    .pipe(z.email('Enter a valid email')),
  password: z
    .string({ error: 'Enter your password' })
    .min(1, 'Enter your password')
    .max(
      PASSWORD_MAX_LENGTH,
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    ),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
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
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
