import {
  createUserSchema,
  listUsersQuerySchema,
  publicUserSchema,
  setPasswordSchema,
  updateMeSchema,
  updateUserSchema,
  userIdParamSchema,
} from '@starter/shared';
import { createZodDto } from 'nestjs-zod';

export class PublicUserDto extends createZodDto(publicUserSchema) {}

export class UserIdParamDto extends createZodDto(userIdParamSchema) {}

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

export class CreateUserDto extends createZodDto(createUserSchema) {}

export class UpdateUserDto extends createZodDto(updateUserSchema) {}

export class UpdateMeDto extends createZodDto(updateMeSchema) {}

export class SetPasswordDto extends createZodDto(setPasswordSchema) {}
