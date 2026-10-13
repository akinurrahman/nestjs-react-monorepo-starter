import { changePasswordSchema } from '@starter/shared';
import { z } from 'zod';

// The profile form uses updateMeSchema from @starter/shared as it is.

// confirmNewPassword is web-only. account.api.ts sends the two shared fields
// alone, since the api rejects unknown fields.
export const changePasswordFormSchema = changePasswordSchema
  .extend({
    confirmNewPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordFormValues = z.output<
  typeof changePasswordFormSchema
>;
