import type { Context } from 'grammy'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { storeMemory } from '../../services/memory/store-memory.js'
import { registerMessageHandler } from './on-message.js'

vi.mock('../../logging/get-logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../services/memory/store-memory.js', () => ({
  storeMemory: vi.fn(),
}))

const MOCK_MEMORY = {
  id: 'mem-1',
  content: 'hello world',
  source: 'telegram',
  search: null,
  category: null,
  tags: null,
  metadata: null,
  sourceDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

const createMockCtx = () =>
  ({
    message: {
      message_id: 42,
      text: 'hello world',
      date: 1708430400,
      chat: { id: 123 },
    },
    from: { id: 456 },
    reply: vi.fn(),
  }) as unknown as Context & { reply: ReturnType<typeof vi.fn> }

const createMockBot = () => ({
  on: vi.fn(),
})

const createMockEmbeddingQueue = () => ({
  enqueue: vi.fn(),
  drain: vi.fn(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockDb = (): any => ({})

describe('registerMessageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storeMemory).mockResolvedValue({
      data: MOCK_MEMORY,
      deduplicated: false,
    })
  })

  test('should register a message:text handler on the bot', () => {
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    expect(bot.on).toHaveBeenCalledWith('message:text', expect.any(Function))
  })

  test('should call storeMemory with message content and telegram metadata', async () => {
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    const ctx = createMockCtx()
    await handler(ctx)

    expect(storeMemory).toHaveBeenCalledWith(db, {
      content: 'hello world',
      source: 'telegram',
      externalId: '42',
      sourceDate: new Date(1708430400 * 1000),
      metadata: { chatId: 123, userId: 456 },
    })
  })

  test('should enqueue embedding after storing memory', async () => {
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    await handler(createMockCtx())

    expect(embeddingQueue.enqueue).toHaveBeenCalledWith('mem-1')
  })

  test('should reply "Stored." on success', async () => {
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    const ctx = createMockCtx()
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('Stored.')
  })

  test('should reply "Already stored." on dedup', async () => {
    vi.mocked(storeMemory).mockResolvedValue({
      data: null,
      deduplicated: true,
    })
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    const ctx = createMockCtx()
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('Already stored.')
  })

  test('should not enqueue embedding on dedup', async () => {
    vi.mocked(storeMemory).mockResolvedValue({
      data: null,
      deduplicated: true,
    })
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    await handler(createMockCtx())

    expect(embeddingQueue.enqueue).not.toHaveBeenCalled()
  })

  test('should reply "Something went wrong." on error', async () => {
    vi.mocked(storeMemory).mockRejectedValue(new Error('DB down'))
    const bot = createMockBot()
    const db = createMockDb()
    const embeddingQueue = createMockEmbeddingQueue()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerMessageHandler(bot as any, { db, embeddingQueue })

    const [, handler] = bot.on.mock.calls[0]
    const ctx = createMockCtx()
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('Something went wrong.')
  })
})
