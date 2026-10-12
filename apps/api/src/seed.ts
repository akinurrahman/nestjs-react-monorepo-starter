import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  createUserSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@starter/shared';
import { PasswordModule } from './auth/password.module.js';
import { PasswordService } from './auth/password.service.js';
import { validateEnv, type Env } from './config/env.schema.js';
import { PrismaModule } from './database/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { UsersRepository } from './users/users.repository.js';

// Creates the first admin from SEED_ADMIN_*. Idempotent: does nothing when a
// user with that email exists. Run with `pnpm --filter @starter/api db:seed`
// (prisma db seed, which builds and runs this file through `nest start`).

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
    const name = config.get('SEED_ADMIN_NAME', { infer: true });
    // Same rules as creating a user through the api: the email is
    // normalized like at login, the password meets the policy.
    const credentials = createUserSchema
      .pick({ email: true, password: true })
      .safeParse({
        email: config.get('SEED_ADMIN_EMAIL', { infer: true }),
        password: config.get('SEED_ADMIN_PASSWORD', { infer: true }),
      });
    if (!credentials.success || name === undefined) {
      throw new Error(
        `Set SEED_ADMIN_EMAIL (a valid email), SEED_ADMIN_PASSWORD (${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters) and SEED_ADMIN_NAME`,
      );
    }

    const users = app.get(UsersRepository);
    if (await users.findByEmail(credentials.data.email)) {
      logger.log('Admin user already exists, nothing to do');
      return;
    }

    const passwordHash = await app
      .get(PasswordService)
      .hash(credentials.data.password);
    await users.create({
      email: credentials.data.email,
      name,
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
