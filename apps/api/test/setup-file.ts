import { inject } from 'vitest';
import { truncateAppTables } from './test-db.js';

// Runs before each test file is imported. ConfigModule lets process.env win
// over apps/api/.env, so AppModule connects to the test database.
const url = inject('databaseUrl');
process.env['DATABASE_URL'] = url;
await truncateAppTables(url);
