import { inject } from 'vitest';
import { readTestDatabaseUrl, truncateAppTables } from './test-db.js';

// Runs before each test file is imported. Every key of .env.test goes into
// process.env, which is all AppModule reads under NODE_ENV=test.
const env = inject('testEnv');
Object.assign(process.env, env);
await truncateAppTables(readTestDatabaseUrl(env));
