import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordModule } from './password.module.js';
import { SessionsRepository } from './sessions.repository.js';

@Module({
  imports: [UsersModule, PasswordModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsRepository,
    AccessTokenService,
    AuthCookieService,
  ],
  // For the global AuthGuard and RolesGuard.
  exports: [AccessTokenService, SessionsRepository],
})
export class AuthModule {}
