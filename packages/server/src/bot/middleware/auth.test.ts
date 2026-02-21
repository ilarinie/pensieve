import type { Context } from 'grammy'
import { describe, expect, test, vi } from 'vitest'

import { createAuthMiddleware } from './auth.js'

const createMockCtx = (userId?: number) =>
  ({
    from: userId !== undefined ? { id: userId } : undefined,
    reply: vi.fn(),
  }) as unknown as Context & { reply: ReturnType<typeof vi.fn> }

describe('createAuthMiddleware', () => {
  const allowedUserIds = ['123', '456']
  const middleware = createAuthMiddleware(allowedUserIds)

  test('should call next for allowed user IDs', async () => {
    const ctx = createMockCtx(123)
    const next = vi.fn()

    await middleware(ctx, next)

    expect(next).toHaveBeenCalledOnce()
  })

  test('should not reply to allowed users', async () => {
    const ctx = createMockCtx(456)
    const next = vi.fn()

    await middleware(ctx, next)

    expect(ctx.reply).not.toHaveBeenCalled()
  })

  test('should reject non-whitelisted user IDs', async () => {
    const ctx = createMockCtx(789)
    const next = vi.fn()

    await middleware(ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith('Not authorized.')
  })

  test('should reject when from is undefined', async () => {
    const ctx = createMockCtx()
    const next = vi.fn()

    await middleware(ctx, next)

    expect(next).not.toHaveBeenCalled()
  })

  test('should not reply when from is undefined', async () => {
    const ctx = createMockCtx()
    const next = vi.fn()

    await middleware(ctx, next)

    expect(ctx.reply).not.toHaveBeenCalled()
  })
})
