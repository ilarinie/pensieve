import { describe, expect, test, vi } from 'vitest'

vi.mock('postgres', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('../env.js', () => ({
  env: { DATABASE_URL: 'postgres://test:test@localhost:5432/test' },
}))

describe('createDb', () => {
  test('should return a Drizzle instance', async () => {
    const { createDb } = await import('./client.js')

    const db = createDb()

    expect(db).toBeDefined()
    expect(db.select).toBeDefined()
    expect(db.insert).toBeDefined()
    expect(db.update).toBeDefined()
    expect(db.delete).toBeDefined()
  })
})
