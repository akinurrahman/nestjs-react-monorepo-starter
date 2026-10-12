import {
  authResponseSchema,
  changePasswordSchema,
  loginSchema,
} from '@starter/shared';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}

export class AuthResponseDto extends createZodDto(authResponseSchema) {}

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
