import { eq } from 'drizzle-orm'
import pLimit from 'p-limit'

import type { Db } from '../../db/client.js'
import { memories, memoryEmbeddings } from '../../db/schema.js'
import { getLogger } from '../../logging/get-logger.js'
import { generateEmbedding } from './generate-embedding.js'

const logger = getLogger(import.meta.url)

/**
 * Dependencies for creating an embedding queue.
 */
export type EmbeddingQueueDeps = {
  db: Db
  ollamaUrl: string
  model: string
}

/**
 * Embedding queue with enqueue and drain functions.
 */
export type EmbeddingQueue = {
  enqueue: (memoryId: string) => void
  drain: () => Promise<void>
}

const CONCURRENCY = 3

/**
 * Creates a concurrency-controlled embedding queue.
 *
 * Accepts memory IDs via `enqueue`, fetches each memory's content from the DB,
 * generates an embedding via Ollama, and stores it in `memory_embeddings`.
 * Concurrency is limited to 3 via `p-limit`. Errors are logged but never
 * propagated — callers treat enqueue as fire-and-forget.
 *
 * @param deps - Database instance, Ollama URL, and model name
 * @returns Object with `enqueue` (non-blocking) and `drain` (waits for pending jobs)
 */
export const createEmbeddingQueue = (
  deps: EmbeddingQueueDeps,
): EmbeddingQueue => {
  const { db, ollamaUrl, model } = deps
  const limit = pLimit(CONCURRENCY)
  const pending: Promise<void>[] = []

  const processMemory = async (memoryId: string): Promise<void> => {
    try {
      const [memory] = await db
        .select()
        .from(memories)
        .where(eq(memories.id, memoryId))
        .limit(1)

      if (!memory) {
        logger.warn('Memory not found for embedding', { memoryId })
        return
      }

      const embedding = await generateEmbedding(
        ollamaUrl,
        model,
        memory.content,
      )

      await db
        .insert(memoryEmbeddings)
        .values({ memoryId, model, embedding })
        .onConflictDoNothing()

      logger.debug('Embedding stored', { memoryId, model })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to process embedding', { memoryId, error: message })
    }
  }

  const enqueue = (memoryId: string): void => {
    const job = limit(() => processMemory(memoryId))
    pending.push(job)
  }

  const drain = async (): Promise<void> => {
    await Promise.all(pending)
    pending.length = 0
  }

  return { enqueue, drain }
}
