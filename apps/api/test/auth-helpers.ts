import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaService } from './../src/database/prisma.service.js';

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
}

// AppModule validates env when it is imported, so each app gets a fresh module
// graph after the env is stubbed. PrismaService comes from that same graph.
export async function createApp({
  env = {},
  controllers = [],
}: {
  env?: Record<string, string | undefined>;
  controllers?: Type[];
} = {}): Promise<TestApp> {
  vi.resetModules();
  vi.stubEnv('TRUST_PROXY', undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

  const { AppModule } = await import('./../src/app.module.js');
  const { configureApp } = await import('./../src/config/app.config.js');
  const { PrismaService } = await import('./../src/database/prisma.service.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  await configureApp(app);
  return { app, prisma: app.get(PrismaService) };
}
