import { sql } from 'drizzle-orm'
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

// Exception to one-export-per-file rule: drizzle-kit requires all tables in
// a single file (or files without cross-imports using .js extensions, which
// conflicts with our ESLint import/extensions rule). Schema files with FK
// references between tables cannot be split without breaking drizzle-kit.

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * Core memory storage table for all ingested content.
 */
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('english', content)`,
    ),
    category: text('category'),
    source: text('source').notNull(),
    tags: text('tags').array(),
    metadata: jsonb('metadata'),
    sourceDate: timestamp('source_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_memories_search').using('gin', table.search),
    index('idx_memories_tags').using('gin', table.tags),
  ],
)

/**
 * Embeddings stored separately for model-swap flexibility.
 */
export const memoryEmbeddings = pgTable(
  'memory_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .references(() => memories.id)
      .notNull(),
    model: text('model').notNull(),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_memory_embeddings_memory_id_model').on(
      table.memoryId,
      table.model,
    ),
  ],
)

/**
 * Tasks extracted from memories or created directly.
 */
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: integer('priority').default(2),
  dueDate: timestamp('due_date', { withTimezone: true }),
  reminderAt: timestamp('reminder_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  sourceMemoryId: uuid('source_memory_id').references(() => memories.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/**
 * Ingestion log for deduplication of imported content.
 *
 * Two-level deduplication:
 * - `(source, dedup_hash)` unique index handles all sources reliably
 * - `(source, external_id)` index provides fast lookup for known-ID sources
 */
export const ingestionLog = pgTable(
  'ingestion_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    externalId: text('external_id'),
    dedupHash: text('dedup_hash').notNull(),
    memoryId: uuid('memory_id')
      .references(() => memories.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('idx_ingestion_log_source_dedup_hash').on(
      table.source,
      table.dedupHash,
    ),
    index('idx_ingestion_log_source_external_id').on(
      table.source,
      table.externalId,
    ),
  ],
)
