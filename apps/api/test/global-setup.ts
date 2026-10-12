import type { TestProject } from 'vitest/node';
import { prepareTestDatabase, readTestDatabaseUrl } from './test-db.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const url = readTestDatabaseUrl();
  await prepareTestDatabase(url);
  project.provide('databaseUrl', url);
}
