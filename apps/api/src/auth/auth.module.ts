import { Module } from '@nestjs/common';
import { AccessTokenService } from './access-token.service.js';

@Module({
  providers: [AccessTokenService],
  // For the global AuthGuard.
  exports: [AccessTokenService],
})
export class AuthModule {}
