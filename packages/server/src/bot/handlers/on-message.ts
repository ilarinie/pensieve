import type { Bot, Context } from 'grammy'

import type { Db } from '../../db/client.js'
import { getLogger } from '../../logging/get-logger.js'
import type { EmbeddingQueue } from '../../services/embedding/index.js'
import { storeMemory } from '../../services/memory/store-memory.js'

const logger = getLogger(import.meta.url)

/**
 * Dependencies for the message handler.
 */
export type MessageHandlerDeps = {
  db: Db
  embeddingQueue: EmbeddingQueue
}

/**
 * Registers a message:text handler on the bot that stores incoming messages
 * as memories and enqueues them for embedding generation.
 *
 * @param bot - The grammY bot instance to register the handler on
 * @param deps - Database instance and embedding queue
 */
export const registerMessageHandler = (
  bot: Pick<Bot, 'on'>,
  deps: MessageHandlerDeps,
): void => {
  const { db, embeddingQueue } = deps

  bot.on('message:text', async (ctx: Context) => {
    try {
      const message = ctx.message!
      const text = message.text!
      const messageId = String(message.message_id)
      const sourceDate = new Date(message.date * 1000)
      const chatId = message.chat.id
      const userId = ctx.from!.id

      const result = await storeMemory(db, {
        content: text,
        source: 'telegram',
        externalId: messageId,
        sourceDate,
        metadata: { chatId, userId },
      })

      if (result.deduplicated) {
        await ctx.reply('Already stored.')
        return
      }

      embeddingQueue.enqueue(result.data.id)
      await ctx.reply('Stored.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to handle message', { error: message })
      await ctx.reply('Something went wrong.')
    }
  })
}
