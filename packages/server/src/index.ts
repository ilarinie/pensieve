import { createApp } from './app.js'
import { createBot } from './bot/create-bot.js'
import { registerMessageHandler } from './bot/handlers/on-message.js'
import { createDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { env } from './env.js'
import { getLogger } from './logging/get-logger.js'
import { createEmbeddingQueue } from './services/embedding/embedding-queue.js'

const logger = getLogger(import.meta.url)

const EMBEDDING_MODEL = 'nomic-embed-text'

/**
 * Starts the server by initializing all services in order:
 * DB, migrations, embedding queue, bot with message handler, Express, and bot polling.
 * Registers graceful shutdown handlers for SIGTERM and SIGINT.
 */
export const startServer = async (): Promise<void> => {
  const db = createDb()
  await runMigrations(db)

  const embeddingQueue = createEmbeddingQueue({
    db,
    ollamaUrl: env.OLLAMA_BASE_URL,
    model: EMBEDDING_MODEL,
  })

  const bot = createBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ALLOWED_USER_IDS)
  registerMessageHandler(bot, { db, embeddingQueue })

  const app = createApp()
  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`)
  })

  const shutdown = async () => {
    logger.info('Shutting down...')
    bot.stop()
    await embeddingQueue.drain()
    logger.info('Shutdown complete')
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  bot.start()
  logger.info('Bot started')
}

startServer().catch((error: unknown) => {
  logger.error('Failed to start server', { error })
  process.exit(1)
})
