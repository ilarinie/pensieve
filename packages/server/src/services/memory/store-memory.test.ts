import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { storeMemory } from './store-memory.js'

vi.mock('../../logging/get-logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const computeExpectedHash = (
  source: string,
  sourceDate: Date | null | undefined,
  content: string,
) => {
  const dateStr = sourceDate?.toISOString() ?? ''
  return createHash('sha256')
    .update(`${source}:${dateStr}:${content}`)
    .digest('hex')
}

const mockMemory = {
  id: 'mem-123',
  content: 'test content',
  search: null,
  category: null,
  source: 'telegram',
  tags: null,
  metadata: null,
  sourceDate: null,
  createdAt: new Date('2026-02-20T10:00:00Z'),
  updatedAt: new Date('2026-02-20T10:00:00Z'),
  deletedAt: null,
}

const createMockTx = (opts: { hasDuplicate?: boolean } = {}) => {
  const mockLimit = vi
    .fn()
    .mockResolvedValue(opts.hasDuplicate ? [{ id: 'existing' }] : [])
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

  const mockInsert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([mockMemory]),
      then(
        onFulfilled: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(undefined).then(onFulfilled, onRejected)
      },
    })),
  }))

  return { select: mockSelect, insert: mockInsert }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockDb = (opts: { hasDuplicate?: boolean } = {}): any => {
  const tx = createMockTx(opts)
  return {
    transaction: vi.fn(
      async (fn: (tx: ReturnType<typeof createMockTx>) => Promise<unknown>) =>
        fn(tx),
    ),
    mockTx: tx,
  }
}

const getInsertValues = (
  tx: ReturnType<typeof createMockTx>,
  callIndex: number,
) => {
  const [valuesCall] = tx.insert.mock.results[callIndex].value.values.mock.calls
  return valuesCall[0]
}

describe('storeMemory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('should insert memory and ingestion log in a transaction', async () => {
    const db = createMockDb()
    const input = {
      content: 'Remember to buy milk',
      source: 'telegram',
    }

    const result = await storeMemory(db, input)

    expect(result.deduplicated).toBe(false)
    expect(result.data).toEqual(mockMemory)
    expect(db.transaction).toHaveBeenCalledOnce()
  })

  test('should call insert for memories table with correct values', async () => {
    const db = createMockDb()
    const sourceDate = new Date('2026-02-20T12:00:00Z')
    const input = {
      content: 'Remember to buy milk',
      source: 'telegram',
      category: 'task',
      tags: ['shopping'],
      metadata: { chatId: 123 },
      sourceDate,
    }

    await storeMemory(db, input)

    expect(getInsertValues(db.mockTx, 0)).toEqual({
      content: 'Remember to buy milk',
      source: 'telegram',
      category: 'task',
      tags: ['shopping'],
      metadata: { chatId: 123 },
      sourceDate,
      deletedAt: null,
    })
  })

  test('should call insert for ingestion log with dedup hash', async () => {
    const db = createMockDb()
    const input = {
      content: 'Remember to buy milk',
      source: 'telegram',
      externalId: 'msg-456',
    }

    await storeMemory(db, input)

    expect(db.mockTx.insert).toHaveBeenCalledTimes(2)

    const expectedHash = computeExpectedHash(
      'telegram',
      null,
      'Remember to buy milk',
    )
    expect(getInsertValues(db.mockTx, 1)).toEqual({
      source: 'telegram',
      externalId: 'msg-456',
      dedupHash: expectedHash,
      memoryId: 'mem-123',
    })
  })

  test('should compute dedup hash from source + sourceDate + content', async () => {
    const db = createMockDb()
    const sourceDate = new Date('2026-02-20T12:00:00Z')
    const input = {
      content: 'test content',
      source: 'whatsapp',
      sourceDate,
    }

    await storeMemory(db, input)

    const expectedHash = computeExpectedHash(
      'whatsapp',
      sourceDate,
      'test content',
    )
    expect(getInsertValues(db.mockTx, 1).dedupHash).toBe(expectedHash)
  })

  test('should return deduplicated result when hash already exists', async () => {
    const db = createMockDb({ hasDuplicate: true })
    const input = {
      content: 'duplicate content',
      source: 'telegram',
    }

    const result = await storeMemory(db, input)

    expect(result).toEqual({ data: null, deduplicated: true })
  })

  test('should not insert when duplicate is detected', async () => {
    const db = createMockDb({ hasDuplicate: true })
    const input = {
      content: 'duplicate content',
      source: 'telegram',
    }

    await storeMemory(db, input)

    expect(db.mockTx.insert).not.toHaveBeenCalled()
  })

  test('should use null for optional fields when not provided', async () => {
    const db = createMockDb()
    const input = {
      content: 'minimal input',
      source: 'telegram',
    }

    await storeMemory(db, input)

    expect(getInsertValues(db.mockTx, 0)).toEqual({
      content: 'minimal input',
      source: 'telegram',
      category: null,
      tags: null,
      metadata: null,
      sourceDate: null,
      deletedAt: null,
    })
  })

  test('should use null for externalId when not provided', async () => {
    const db = createMockDb()
    const input = {
      content: 'test',
      source: 'telegram',
    }

    await storeMemory(db, input)

    expect(getInsertValues(db.mockTx, 1).externalId).toBeNull()
  })
})
