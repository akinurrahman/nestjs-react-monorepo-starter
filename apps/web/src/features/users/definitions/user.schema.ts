import { createUserSchema, setPasswordSchema } from '@starter/shared';
import { z } from 'zod';

// The create form uses createUserSchema from @starter/shared as it is.

// Password is set from its own dialog, never from the edit form.
export const userEditFormSchema = createUserSchema.omit({ password: true });

// confirmPassword is web-only. user.api.ts sends the password alone, since
// the api rejects unknown fields.
export const userPasswordFormSchema = setPasswordSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirm the password') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type UserEditFormInput = z.input<typeof userEditFormSchema>;
export type UserEditFormValues = z.output<typeof userEditFormSchema>;
export type UserPasswordFormValues = z.output<typeof userPasswordFormSchema>;
