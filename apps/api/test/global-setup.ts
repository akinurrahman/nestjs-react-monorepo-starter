import type { TestProject } from 'vitest/node';
import {
  prepareTestDatabase,
  readTestDatabaseUrl,
  readTestEnv,
} from './test-db.js';

declare module 'vitest' {
  export interface ProvidedContext {
    testEnv: Record<string, string>;
  }
}

export default async function setup(project: TestProject) {
  const env = readTestEnv();
  await prepareTestDatabase(readTestDatabaseUrl(env));
  project.provide('testEnv', env);
}
