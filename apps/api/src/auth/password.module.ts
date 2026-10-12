import { Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';

// Its own module because both AuthModule and UsersModule hash passwords, and
// AuthModule already imports UsersModule.
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
