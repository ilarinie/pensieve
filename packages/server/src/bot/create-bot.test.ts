import { Bot } from 'grammy'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createBot } from './create-bot.js'

vi.mock('grammy', () => {
  const BotMock = vi.fn().mockImplementation(() => ({
    use: vi.fn(),
  }))
  return { Bot: BotMock }
})

describe('createBot', () => {
  beforeEach(() => {
    vi.mocked(Bot).mockClear()
  })

  test('should create a Bot instance with the given token', () => {
    createBot('test-token', ['123'])

    expect(Bot).toHaveBeenCalledWith('test-token')
  })

  test('should return the bot instance', () => {
    const bot = createBot('test-token', ['123'])

    expect(bot).toBeDefined()
    expect(bot.use).toBeDefined()
  })

  test('should install auth middleware on the bot', () => {
    const bot = createBot('test-token', ['123', '456'])

    expect(bot.use).toHaveBeenCalledOnce()
    expect(bot.use).toHaveBeenCalledWith(expect.any(Function))
  })
})
