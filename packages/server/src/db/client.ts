import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '../env.js'

/**
 * Creates and returns the Drizzle database client.
 *
 * @returns The configured Drizzle ORM instance
 */
export const createDb = () => {
  const client = postgres(env.DATABASE_URL)
  return drizzle(client)
}
