import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, test } from 'vitest'

import { ingestionLog, memories, memoryEmbeddings, tasks } from './schema.js'

describe('memories', () => {
  test('should have correct table name', () => {
    expect(getTableName(memories)).toBe('memories')
  })

  test('should have all required columns', () => {
    const config = getTableConfig(memories)
    const columnNames = config.columns.map((col) => col.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('content')
    expect(columnNames).toContain('search')
    expect(columnNames).toContain('category')
    expect(columnNames).toContain('source')
    expect(columnNames).toContain('tags')
    expect(columnNames).toContain('metadata')
    expect(columnNames).toContain('source_date')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')
    expect(columnNames).toContain('deleted_at')
  })

  test('should have GIN index on search column', () => {
    const config = getTableConfig(memories)
    const searchIndex = config.indexes.find(
      (i) => i.config.name === 'idx_memories_search',
    )

    expect(searchIndex).toBeDefined()
    expect(searchIndex?.config.method).toBe('gin')
  })

  test('should have GIN index on tags column', () => {
    const config = getTableConfig(memories)
    const tagsIndex = config.indexes.find(
      (i) => i.config.name === 'idx_memories_tags',
    )

    expect(tagsIndex).toBeDefined()
    expect(tagsIndex?.config.method).toBe('gin')
  })
})

describe('memoryEmbeddings', () => {
  test('should have correct table name', () => {
    expect(getTableName(memoryEmbeddings)).toBe('memory_embeddings')
  })

  test('should have all required columns', () => {
    const config = getTableConfig(memoryEmbeddings)
    const columnNames = config.columns.map((col) => col.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('memory_id')
    expect(columnNames).toContain('model')
    expect(columnNames).toContain('embedding')
    expect(columnNames).toContain('created_at')
  })

  test('should have unique constraint on memory_id and model', () => {
    const config = getTableConfig(memoryEmbeddings)
    const uniqueConstraint = config.uniqueConstraints.find(
      (col) => col.name === 'uq_memory_embeddings_memory_id_model',
    )

    expect(uniqueConstraint).toBeDefined()
  })

  test('should not have HNSW vector index', () => {
    const config = getTableConfig(memoryEmbeddings)
    const hnswIndex = config.indexes.find((i) => i.config.method === 'hnsw')

    expect(hnswIndex).toBeUndefined()
  })
})

describe('tasks', () => {
  test('should have correct table name', () => {
    expect(getTableName(tasks)).toBe('tasks')
  })

  test('should have all required columns', () => {
    const config = getTableConfig(tasks)
    const columnNames = config.columns.map((col) => col.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('title')
    expect(columnNames).toContain('description')
    expect(columnNames).toContain('status')
    expect(columnNames).toContain('priority')
    expect(columnNames).toContain('due_date')
    expect(columnNames).toContain('reminder_at')
    expect(columnNames).toContain('snoozed_until')
    expect(columnNames).toContain('completed_at')
    expect(columnNames).toContain('source_memory_id')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')
  })
})

describe('ingestionLog', () => {
  test('should have correct table name', () => {
    expect(getTableName(ingestionLog)).toBe('ingestion_log')
  })

  test('should have all required columns', () => {
    const config = getTableConfig(ingestionLog)
    const columnNames = config.columns.map((col) => col.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('source')
    expect(columnNames).toContain('external_id')
    expect(columnNames).toContain('dedup_hash')
    expect(columnNames).toContain('memory_id')
    expect(columnNames).toContain('created_at')
  })

  test('should have unique index on source and dedup_hash', () => {
    const config = getTableConfig(ingestionLog)
    const uniqueIdx = config.indexes.find(
      (i) => i.config.name === 'idx_ingestion_log_source_dedup_hash',
    )

    expect(uniqueIdx).toBeDefined()
    expect(uniqueIdx?.config.unique).toBe(true)
  })

  test('should have index on source and external_id', () => {
    const config = getTableConfig(ingestionLog)
    const idx = config.indexes.find(
      (i) => i.config.name === 'idx_ingestion_log_source_external_id',
    )

    expect(idx).toBeDefined()
  })
})
