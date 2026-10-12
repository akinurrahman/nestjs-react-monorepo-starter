import { Module } from '@nestjs/common';
import { PasswordModule } from '../auth/password.module.js';
import { UsersMeController } from './users-me.controller.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PasswordModule],
  // Order matters: /users/me before /users/:id.
  controllers: [UsersMeController, UsersController],
  providers: [UsersRepository, UsersService],
  // For AuthService (login, me, change password) and the seed.
  exports: [UsersRepository],
})
export class UsersModule {}
