import { z } from 'zod';
import { emailSchema, newPasswordSchema } from './auth.js';
import { paginationQuerySchema } from './pagination.js';
import { queryArray } from './query-array.js';
import { queryBoolean } from './query-boolean.js';
import { roleSchema } from './roles.js';

export const USER_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  // Sent with a field error on `email`.
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  // Disabling or demoting the last active admin.
  LAST_ADMIN: 'LAST_ADMIN',
  CANNOT_DISABLE_SELF: 'CANNOT_DISABLE_SELF',
  CANNOT_CHANGE_OWN_ROLE: 'CANNOT_CHANGE_OWN_ROLE',
} as const;

export const USER_NAME_MAX_LENGTH = 100;
export const USER_SEARCH_MAX_LENGTH = 100;

const userNameSchema = z.string().trim().min(1).max(USER_NAME_MAX_LENGTH);

export const userIdParamSchema = z.object({ id: z.uuid() });

// `search` matches name or email, case-insensitive. An empty one is no filter.
export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(USER_SEARCH_MAX_LENGTH).optional(),
  role: queryArray(roleSchema).optional(),
  isActive: queryBoolean().optional(),
});

export const createUserSchema = z.strictObject({
  email: emailSchema,
  name: userNameSchema,
  role: roleSchema,
  password: newPasswordSchema,
});

export const updateUserSchema = z
  .strictObject({
    email: emailSchema.optional(),
    name: userNameSchema.optional(),
    role: roleSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

// A user's own profile. Email and role are not theirs to change.
export const updateMeSchema = z.strictObject({
  name: userNameSchema,
});

export const setPasswordSchema = z.strictObject({
  password: newPasswordSchema,
});

export type UserErrorCode =
  (typeof USER_ERROR_CODES)[keyof typeof USER_ERROR_CODES];
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateMeInput = z.input<typeof updateMeSchema>;
export type SetPasswordInput = z.input<typeof setPasswordSchema>;
