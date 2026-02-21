import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { generateEmbedding } from './generate-embedding.js'

const OLLAMA_URL = 'http://localhost:11434'
const MODEL = 'nomic-embed-text'
const MOCK_EMBEDDING = [0.1, 0.2, 0.3, 0.4, 0.5]

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embeddings: [MOCK_EMBEDDING] }),
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should call Ollama /api/embed with correct request', async () => {
    await generateEmbedding(OLLAMA_URL, MODEL, 'hello world')

    expect(fetch).toHaveBeenCalledWith(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: 'hello world' }),
    })
  })

  test('should return the embedding vector', async () => {
    const result = await generateEmbedding(OLLAMA_URL, MODEL, 'hello world')

    expect(result).toEqual(MOCK_EMBEDDING)
  })

  test('should throw on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('model not found'),
      }),
    )

    await expect(generateEmbedding(OLLAMA_URL, MODEL, 'hello')).rejects.toThrow(
      'Ollama embedding failed (500 Internal Server Error): model not found',
    )
  })

  test('should throw on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(generateEmbedding(OLLAMA_URL, MODEL, 'hello')).rejects.toThrow(
      'Failed to connect to Ollama at http://localhost:11434: ECONNREFUSED',
    )
  })

  test('should pass ollamaUrl and model as provided', async () => {
    const customUrl = 'http://ollama:8080'
    const customModel = 'mxbai-embed-large'

    await generateEmbedding(customUrl, customModel, 'test')

    expect(fetch).toHaveBeenCalledWith(`${customUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: customModel, input: 'test' }),
    })
  })
})
