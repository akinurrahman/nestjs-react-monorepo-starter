import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Role } from '@starter/shared';
import request from 'supertest';
import { hashPassword } from './../src/auth/password.js';
import type { PrismaService } from './../src/database/prisma.service.js';

export const COOKIE_NAME = 'refresh_token';
export const PASSWORD = 'correct horse battery staple';

// Cheap argon2 parameters: hashes carry their parameters, so login verifies
// them like any other, and the suite stays fast.
const FAST_ARGON2 = { memory: 64, passes: 1, parallelism: 1 };

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

let counter = 0;

// Each test gets its own user, so the per-email login limit never carries
// over between tests.
export function uniqueEmail(): string {
  counter += 1;
  return `user${counter}-${Date.now()}@example.com`;
}

export async function createUser(
  prisma: PrismaService,
  {
    email = uniqueEmail(),
    role = 'USER',
    isActive = true,
  }: { email?: string; role?: Role; isActive?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      email,
      name: 'Test User',
      role,
      isActive,
      passwordHash: await hashPassword(PASSWORD, FAST_ARGON2),
    },
  });
}

export function login(app: NestExpressApplication, email: string) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
}

export interface SetCookie {
  value: string;
  attributes: Record<string, string | true>;
}

// The refresh cookie from a response's Set-Cookie headers, if any.
export function refreshCookie(res: request.Response): SetCookie | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const header = raw?.find((h) => h.startsWith(`${COOKIE_NAME}=`));
  if (!header) return undefined;
  const [pair, ...attrs] = header.split(';').map((part) => part.trim());
  const attributes: Record<string, string | true> = {};
  for (const attr of attrs) {
    const [key, ...rest] = attr.split('=');
    attributes[key!.toLowerCase()] = rest.length ? rest.join('=') : true;
  }
  return { value: pair!.slice(COOKIE_NAME.length + 1), attributes };
}

export function cookieHeader(value: string): string {
  return `${COOKIE_NAME}=${value}`;
}

export function refresh(app: NestExpressApplication, cookie?: string) {
  const req = request(app.getHttpServer()).post('/api/auth/refresh');
  return cookie === undefined ? req : req.set('Cookie', cookieHeader(cookie));
}

export async function loginCookie(
  app: NestExpressApplication,
  email: string,
): Promise<{ cookie: string; accessToken: string }> {
  const res = await login(app, email).expect(200);
  const cookie = refreshCookie(res);
  if (!cookie) throw new Error('login set no refresh cookie');
  return {
    cookie: cookie.value,
    accessToken: (res.body as { data: { accessToken: string } }).data
      .accessToken,
  };
}

export function sessionIdOf(cookie: string): string {
  return cookie.split('.')[0]!;
}
