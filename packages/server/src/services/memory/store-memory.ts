import { and, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'

import type { Memory } from '../../../../types/index.js'
import type { Db } from '../../db/client.js'
import { ingestionLog, memories } from '../../db/schema.js'
import { getLogger } from '../../logging/get-logger.js'

const logger = getLogger(import.meta.url)

/**
 * Input for storing a new memory with optional dedup fields.
 */
export type StoreMemoryInput = {
  content: string
  source: string
  category?: string | null
  tags?: string[] | null
  metadata?: unknown
  sourceDate?: Date | null
  externalId?: string | null
}

/**
 * Result of a store memory operation.
 * Either the created memory or a dedup-skip indicator.
 */
export type StoreMemoryResult =
  | { data: Memory; deduplicated: false }
  | { data: null; deduplicated: true }

const computeDedupHash = (
  source: string,
  sourceDate: Date | null | undefined,
  content: string,
): string => {
  const dateStr = sourceDate?.toISOString() ?? ''
  return createHash('sha256')
    .update(`${source}:${dateStr}:${content}`)
    .digest('hex')
}

/**
 * Stores a new memory in the database with deduplication.
 *
 * Inserts into the `memories` and `ingestion_log` tables atomically within a
 * transaction. Computes a SHA-256 dedup hash from source + sourceDate + content.
 * If a matching hash already exists for the same source, returns a dedup-skip
 * result instead of inserting.
 *
 * @param db - Drizzle database instance
 * @param input - Memory content, metadata, and optional dedup fields
 * @returns The created memory or a dedup-skip indicator
 */
export const storeMemory = async (
  db: Db,
  input: StoreMemoryInput,
): Promise<StoreMemoryResult> => {
  const dedupHash = computeDedupHash(
    input.source,
    input.sourceDate,
    input.content,
  )

  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(ingestionLog)
      .where(
        and(
          eq(ingestionLog.source, input.source),
          eq(ingestionLog.dedupHash, dedupHash),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      logger.debug('Duplicate memory detected, skipping', {
        source: input.source,
        dedupHash,
      })
      return null
    }

    const [memory] = await tx
      .insert(memories)
      .values({
        content: input.content,
        source: input.source,
        category: input.category ?? null,
        tags: input.tags ?? null,
        metadata: input.metadata ?? null,
        sourceDate: input.sourceDate ?? null,
        deletedAt: null,
      })
      .returning()

    await tx.insert(ingestionLog).values({
      source: input.source,
      externalId: input.externalId ?? null,
      dedupHash,
      memoryId: memory.id,
    })

    return memory
  })

  if (!result) {
    return { data: null, deduplicated: true }
  }

  return { data: result as Memory, deduplicated: false }
}
