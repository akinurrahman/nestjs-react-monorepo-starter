import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  createUserSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '@starter/shared';
import { PasswordModule } from './auth/password.module.js';
import { PasswordService } from './auth/password.service.js';
import { validateEnv, type Env } from './config/env.schema.js';
import { PrismaModule } from './database/prisma.module.js';
import { existingUserOutcome } from './seed-outcome.js';
import { UsersModule } from './users/users.module.js';
import { UsersRepository } from './users/users.repository.js';

// Creates the first admin from SEED_ADMIN_*. Idempotent: never changes a user
// that already has that email, and fails only when that leaves no active
// admin (see existingUserOutcome). Run with `pnpm db:seed` from the repo root:
// Turbo builds the shared package, then prisma db seed builds and runs this
// file through `nest start`.

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    PasswordModule,
    UsersModule,
  ],
})
class SeedModule {}

const logger = new Logger('Seed');

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const config = app.get(ConfigService<Env, true>);
    // Same rules as creating a user through the api: the email is
    // normalized like at login, the name is trimmed and bounded, the
    // password meets the policy.
    const credentials = createUserSchema
      .pick({ email: true, name: true, password: true })
      .safeParse({
        email: config.get('SEED_ADMIN_EMAIL', { infer: true }),
        name: config.get('SEED_ADMIN_NAME', { infer: true }),
        password: config.get('SEED_ADMIN_PASSWORD', { infer: true }),
      });
    if (!credentials.success) {
      throw new Error(
        `Set SEED_ADMIN_EMAIL (a valid email), SEED_ADMIN_PASSWORD (${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters) and SEED_ADMIN_NAME (1 to ${USER_NAME_MAX_LENGTH} characters)`,
      );
    }

    const users = app.get(UsersRepository);
    const existing = await users.findByEmail(credentials.data.email);
    if (existing) {
      const { total: activeAdmins } = await users.list({
        page: 1,
        limit: 1,
        role: ['ADMIN'],
        isActive: true,
      });
      const outcome = existingUserOutcome(existing, activeAdmins > 0);
      if (outcome.level === 'error') throw new Error(outcome.message);
      logger[outcome.level](outcome.message);
      return;
    }

    const passwordHash = await app
      .get(PasswordService)
      .hash(credentials.data.password);
    await users.create({
      email: credentials.data.email,
      name: credentials.data.name,
      passwordHash,
      role: 'ADMIN',
    });
    logger.log('Admin user created');
  } finally {
    await app.close();
  }
}

try {
  await seed();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
