import request from 'supertest'
import { describe, expect, test } from 'vitest'

import { createApp } from './app.js'

describe('createApp', () => {
  const app = createApp()

  test('should return 200 with status ok on /health-check', async () => {
    const response = await request(app).get('/health-check')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
