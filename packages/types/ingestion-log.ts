/**
 * An ingestion log entry used for deduplication of imported content.
 */
export type IngestionLogEntry = {
  id: string
  source: string
  externalId: string | null
  dedupHash: string
  memoryId: string
  createdAt: Date
}

/**
 * Input for creating a new ingestion log entry. Omits auto-generated fields.
 */
export type NewIngestionLogEntry = Omit<IngestionLogEntry, 'id' | 'createdAt'>
