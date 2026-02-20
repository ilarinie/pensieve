import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '../env.js'
import * as schema from './schema.js'

/**
 * Creates and returns the Drizzle database client with schema for type-safe queries.
 *
 * @returns The configured Drizzle ORM instance with schema attached
 */
export const createDb = () => {
  const client = postgres(env.DATABASE_URL)
  return drizzle(client, { schema })
}

/**
 * Drizzle database instance type for dependency injection.
 */
export type Db = ReturnType<typeof createDb>
