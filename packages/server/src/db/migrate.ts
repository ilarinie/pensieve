import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { createDb } from './client.js'

/**
 * Runs all pending database migrations.
 *
 * @returns Promise that resolves when migrations are complete
 */
export const runMigrations = async () => {
  const db = createDb()
  await migrate(db, {
    migrationsFolder: './packages/server/src/db/migrations',
  })
}

runMigrations()
