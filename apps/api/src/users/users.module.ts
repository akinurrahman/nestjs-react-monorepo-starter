import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';

// Repository only for now; the users endpoints come with the users module.
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
