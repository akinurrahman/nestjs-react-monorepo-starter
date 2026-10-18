import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    // Builds the app and runs dist/seed.js. Through Nest's build, not tsx:
    // esbuild drops decorator metadata, which Nest's injection needs.
    seed: 'nest start --entryFile seed',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
    // Only the e2e migration drift check sets this. Left out otherwise, so
    // `migrate dev` keeps creating and dropping its own temporary shadow
    // database.
    ...(process.env['SHADOW_DATABASE_URL'] && {
      shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
    }),
  },
});
