import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { getLogger } from '../logging/get-logger.js'
import type { Db } from './client.js'
import { createDb } from './client.js'

const logger = getLogger(import.meta.url)

/**
 * Runs all pending database migrations.
 *
 * @param db - Drizzle database instance
 * @returns Promise that resolves when migrations are complete
 */
export const runMigrations = async (db: Db) => {
  await migrate(db, {
    migrationsFolder: './packages/server/src/db/migrations',
  })
}

const isMainModule =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js')

if (isMainModule) {
  const db = createDb()
  runMigrations(db)
    .then(() => {
      logger.info('Migrations completed successfully')
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error('Migration failed', { error })
      process.exit(1)
    })
}
