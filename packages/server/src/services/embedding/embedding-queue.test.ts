import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createEmbeddingQueue } from './embedding-queue.js'
import { generateEmbedding } from './generate-embedding.js'

vi.mock('../../logging/get-logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('./generate-embedding.js', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}))

const MOCK_MEMORY = {
  id: 'mem-1',
  content: 'test content',
  source: 'telegram',
}

const createMockDb = (
  opts: {
    memory?: typeof MOCK_MEMORY | null
    hasExistingEmbedding?: boolean
  } = {},
) => {
  const memory = opts.memory === undefined ? MOCK_MEMORY : opts.memory

  const mockSelectLimit = vi.fn().mockResolvedValue(memory ? [memory] : [])
  const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit })
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom })

  const mockInsertValues = vi.fn().mockImplementation(() => ({
    then(
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) {
      return Promise.resolve(undefined).then(onFulfilled, onRejected)
    },
    onConflictDoNothing: vi.fn().mockReturnValue({
      then(
        onFulfilled: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(undefined).then(onFulfilled, onRejected)
      },
    }),
  }))
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { select: mockSelect, insert: mockInsert } as any
}

const DEPS = {
  ollamaUrl: 'http://localhost:11434',
  model: 'nomic-embed-text',
}

describe('createEmbeddingQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3])
  })

  test('should return enqueue and drain functions', () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    expect(queue.enqueue).toBeTypeOf('function')
    expect(queue.drain).toBeTypeOf('function')
  })

  test('should fetch memory, generate embedding, and insert', async () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('mem-1')
    await queue.drain()

    expect(db.select).toHaveBeenCalled()
    expect(generateEmbedding).toHaveBeenCalledWith(
      'http://localhost:11434',
      'nomic-embed-text',
      'test content',
    )
    expect(db.insert).toHaveBeenCalled()
  })

  test('should insert embedding with correct values', async () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('mem-1')
    await queue.drain()

    const [insertValues] = db.insert.mock.results[0].value.values.mock.calls
    expect(insertValues[0]).toEqual({
      memoryId: 'mem-1',
      model: 'nomic-embed-text',
      embedding: [0.1, 0.2, 0.3],
    })
  })

  test('should skip when memory not found', async () => {
    const db = createMockDb({ memory: null })
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('nonexistent')
    await queue.drain()

    expect(generateEmbedding).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  test('should not throw on generateEmbedding failure', async () => {
    vi.mocked(generateEmbedding).mockRejectedValueOnce(new Error('Ollama down'))
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('mem-1')

    await expect(queue.drain()).resolves.toBeUndefined()
  })

  test('should not throw on DB insert failure', async () => {
    const db = createMockDb()
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoNothing: vi.fn().mockReturnValue({
          then(
            _onFulfilled: (v: unknown) => unknown,
            onRejected?: (e: unknown) => unknown,
          ) {
            return Promise.reject(new Error('DB error')).catch(
              onRejected ?? (() => {}),
            )
          },
        }),
      })),
    })
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('mem-1')

    await expect(queue.drain()).resolves.toBeUndefined()
  })

  test('should process multiple enqueued items', async () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    queue.enqueue('mem-1')
    queue.enqueue('mem-2')
    queue.enqueue('mem-3')
    await queue.drain()

    expect(generateEmbedding).toHaveBeenCalledTimes(3)
  })

  test('should return immediately from enqueue', () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    const result = queue.enqueue('mem-1')

    expect(result).toBeUndefined()
  })

  test('should drain with no pending jobs', async () => {
    const db = createMockDb()
    const queue = createEmbeddingQueue({ db, ...DEPS })

    await expect(queue.drain()).resolves.toBeUndefined()
  })
})
