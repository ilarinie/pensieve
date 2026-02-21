import { Bot } from 'grammy'

import { createAuthMiddleware } from './middleware/auth.js'

/**
 * Creates and configures a grammY Bot instance with auth middleware.
 *
 * The bot is configured with an auth middleware that restricts access to the
 * given list of Telegram user IDs. Long polling is used for development;
 * webhook support is deferred to Phase 9 (deployment).
 *
 * @param token - Telegram bot token
 * @param allowedUserIds - Array of allowed Telegram user IDs as strings
 * @returns A configured grammY Bot instance
 */
export const createBot = (token: string, allowedUserIds: string[]) => {
  const bot = new Bot(token)

  bot.use(createAuthMiddleware(allowedUserIds))

  return bot
}
