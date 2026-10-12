import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { basicAuth } from '../common/middleware/basic-auth.middleware.js';
import type { Env } from './env.schema.js';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_JSON_PATH = 'docs-json';
// Served by SwaggerModule.setup as well, at its default URL.
export const SWAGGER_YAML_PATH = 'docs-yaml';

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  // Every operation requires the bearer token, as AuthGuard does; @Public()
  // overrides it per route with an empty requirement.
  const config = new DocumentBuilder()
    .setTitle('Starter API')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addSecurityRequirements('bearer')
    .build();

  // Required by nestjs-zod: strips its x-nestjs_zod-* markers, applies
  // `.meta({ id })` renames and hoists nested zod schemas into components.
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

// Returns whether the docs were mounted.
export function setupSwagger(app: INestApplication): boolean {
  const config = app.get(ConfigService<Env, true>);
  if (!config.get('SWAGGER_ENABLED', { infer: true })) return false;

  // The env schema only allows both or neither.
  const user = config.get('SWAGGER_USER', { infer: true });
  const password = config.get('SWAGGER_PASSWORD', { infer: true });
  if (user !== undefined && password !== undefined) {
    // Registered before the docs routes so it runs first. A path also
    // matches everything below it, which covers the UI assets under /docs.
    app.use(
      [SWAGGER_PATH, SWAGGER_JSON_PATH, SWAGGER_YAML_PATH].map((p) => `/${p}`),
      basicAuth({ user, password }, 'API docs'),
    );
  }

  SwaggerModule.setup(SWAGGER_PATH, app, createSwaggerDocument(app), {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    yamlDocumentUrl: SWAGGER_YAML_PATH,
  });
  return true;
}
