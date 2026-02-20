/**
 * A stored memory record with all fields populated.
 */
export type Memory = {
  id: string
  content: string
  search: string | null
  category: string | null
  source: string
  tags: string[] | null
  metadata: unknown
  sourceDate: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * Input for creating a new memory. Omits auto-generated fields.
 */
export type NewMemory = Omit<
  Memory,
  'id' | 'search' | 'createdAt' | 'updatedAt'
>

/**
 * A memory embedding record linking a memory to its vector representation.
 */
export type MemoryEmbedding = {
  id: string
  memoryId: string
  model: string
  embedding: number[]
  createdAt: Date
}

/**
 * Input for creating a new memory embedding. Omits auto-generated fields.
 */
export type NewMemoryEmbedding = Omit<MemoryEmbedding, 'id' | 'createdAt'>
