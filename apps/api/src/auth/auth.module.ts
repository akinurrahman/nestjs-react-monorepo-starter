import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionsRepository } from './sessions.repository.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsRepository,
    PasswordService,
    AccessTokenService,
    AuthCookieService,
  ],
  // For the global AuthGuard.
  exports: [AccessTokenService],
})
export class AuthModule {}
