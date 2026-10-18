import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { RolesGuard } from './auth/roles.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { validateEnv, type Env } from './config/env.schema.js';
import {
  createHttpLogger,
  createLoggerParams,
  HTTP_LOGGER,
} from './config/logger.config.js';
import { RATE_LIMIT } from './config/throttler.config.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests take every value from the environment (apps/api/.env.test,
      // loaded by the e2e setup), never from a developer's .env.
      ignoreEnvFile: process.env['NODE_ENV'] === 'test',
    }),
    LoggerModule.forRootAsync({
      providers: [
        {
          provide: HTTP_LOGGER,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            createHttpLogger({
              NODE_ENV: config.get('NODE_ENV', { infer: true }),
              LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
            }),
        },
      ],
      inject: [HTTP_LOGGER],
      useFactory: createLoggerParams,
    }),
    ThrottlerModule.forRoot([RATE_LIMIT]),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Global guards run in this order: rate limit first (per IP per route,
    // see RATE_LIMIT), so rejected credentials still count; then
    // authentication (deny by default); then roles, which needs the user
    // authentication set.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
