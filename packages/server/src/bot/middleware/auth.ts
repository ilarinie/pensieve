import type { Context, MiddlewareFn } from 'grammy'

/**
 * Creates auth middleware that restricts bot access to whitelisted Telegram user IDs.
 *
 * Compares the incoming update's user ID against the allowed list. Unauthorized
 * users receive a "Not authorized." reply. Updates without a `from` field
 * (e.g. channel posts) are silently dropped.
 *
 * @param allowedUserIds - Array of allowed Telegram user IDs as strings
 * @returns grammY middleware function
 */
export const createAuthMiddleware = (
  allowedUserIds: string[],
): MiddlewareFn<Context> => {
  const allowedSet = new Set(allowedUserIds.map(Number))

  return async (ctx, next) => {
    const userId = ctx.from?.id
    if (userId === undefined) {
      return
    }

    if (!allowedSet.has(userId)) {
      await ctx.reply('Not authorized.')
      return
    }

    await next()
  }
}
