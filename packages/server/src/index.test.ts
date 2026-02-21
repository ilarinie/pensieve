import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createApp } from './app.js'
import { createBot } from './bot/create-bot.js'
import { registerMessageHandler } from './bot/handlers/on-message.js'
import { createDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { startServer } from './index.js'
import { createEmbeddingQueue } from './services/embedding/embedding-queue.js'

vi.mock('./logging/get-logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('./env.js', () => ({
  env: {
    PORT: '3000',
    DATABASE_URL: 'postgres://localhost/test',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_ALLOWED_USER_IDS: ['123'],
    OLLAMA_BASE_URL: 'http://localhost:11434',
  },
}))

vi.mock('./db/client.js', () => ({
  createDb: vi.fn().mockReturnValue({ mock: 'db' }),
}))

vi.mock('./db/migrate.js', () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./app.js', () => ({
  createApp: vi.fn().mockReturnValue({
    listen: vi.fn((_port: string, cb: () => void) => {
      cb()
      return { close: vi.fn() }
    }),
  }),
}))

vi.mock('./bot/create-bot.js', () => ({
  createBot: vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}))

vi.mock('./bot/handlers/on-message.js', () => ({
  registerMessageHandler: vi.fn(),
}))

vi.mock('./services/embedding/embedding-queue.js', () => ({
  createEmbeddingQueue: vi.fn().mockReturnValue({
    enqueue: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('startServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
  })

  test('should create database client', async () => {
    await startServer()

    expect(createDb).toHaveBeenCalledOnce()
  })

  test('should run migrations', async () => {
    await startServer()

    expect(runMigrations).toHaveBeenCalledWith({ mock: 'db' })
  })

  test('should create embedding queue with correct deps', async () => {
    await startServer()

    expect(createEmbeddingQueue).toHaveBeenCalledWith({
      db: { mock: 'db' },
      ollamaUrl: 'http://localhost:11434',
      model: 'nomic-embed-text',
    })
  })

  test('should create bot with token and allowed user ids', async () => {
    await startServer()

    expect(createBot).toHaveBeenCalledWith('test-token', ['123'])
  })

  test('should register message handler on bot', async () => {
    await startServer()

    const bot = vi.mocked(createBot).mock.results[0].value
    const embeddingQueue = vi.mocked(createEmbeddingQueue).mock.results[0].value

    expect(registerMessageHandler).toHaveBeenCalledWith(bot, {
      db: { mock: 'db' },
      embeddingQueue,
    })
  })

  test('should start express on configured port', async () => {
    await startServer()

    const app = vi.mocked(createApp).mock.results[0].value
    expect(app.listen).toHaveBeenCalledWith('3000', expect.any(Function))
  })

  test('should start bot polling', async () => {
    await startServer()

    const bot = vi.mocked(createBot).mock.results[0].value
    expect(bot.start).toHaveBeenCalledOnce()
  })

  test('should initialize services in correct order', async () => {
    const callOrder: string[] = []
    vi.mocked(createDb).mockImplementation(() => {
      callOrder.push('createDb')
      return { mock: 'db' } as unknown as ReturnType<typeof createDb>
    })
    vi.mocked(runMigrations).mockImplementation(async () => {
      callOrder.push('runMigrations')
    })
    vi.mocked(createEmbeddingQueue).mockImplementation(() => {
      callOrder.push('createEmbeddingQueue')
      return { enqueue: vi.fn(), drain: vi.fn().mockResolvedValue(undefined) }
    })
    vi.mocked(createBot).mockImplementation(() => {
      callOrder.push('createBot')
      return { start: vi.fn(), stop: vi.fn() } as unknown as ReturnType<
        typeof createBot
      >
    })
    vi.mocked(registerMessageHandler).mockImplementation(() => {
      callOrder.push('registerMessageHandler')
    })

    await startServer()

    expect(callOrder).toEqual([
      'createDb',
      'runMigrations',
      'createEmbeddingQueue',
      'createBot',
      'registerMessageHandler',
    ])
  })
})
