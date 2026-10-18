import {
  ensureDatabase,
  readTestDatabaseUrl,
  runPrisma,
  shadowDatabaseUrl,
} from './test-db.js';

// A model change committed without its migration passes every other test:
// the e2e database gets the migrations, while the client is generated from
// the schema. This replays the migrations into a shadow database and diffs
// the result against the schema.
describe('Prisma migrations', () => {
  it('match the schema', async () => {
    const shadow = shadowDatabaseUrl(readTestDatabaseUrl());
    await ensureDatabase(shadow);

    const result = runPrisma(
      [
        'migrate',
        'diff',
        '--from-migrations',
        'prisma/migrations',
        '--to-schema',
        'prisma',
        '--exit-code',
      ],
      { SHADOW_DATABASE_URL: shadow },
    );

    // Exit 2 is a non-empty diff: the output names what the migrations miss.
    // Create a migration for it (see CLAUDE.md, "New migration").
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  }, 60_000);
});
