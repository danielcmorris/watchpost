import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { config } from '../config.js';

/** Apply pending SQL migrations from server/migrations. Safe to run on every boot. */
export async function migrate(): Promise<void> {
  await runner({
    databaseUrl: config.databaseUrl,
    dir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'),
    migrationsTable: 'pgmigrations',
    direction: 'up',
    count: Infinity,
    log: () => {},
  });
}
