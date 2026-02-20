/**
 * Generates a vector embedding for the given text using the Ollama API.
 *
 * Calls the Ollama `/api/embed` endpoint with native `fetch`. Returns the
 * embedding as a `number[]`. Wraps errors with descriptive messages.
 *
 * @param ollamaUrl - Base URL of the Ollama server (e.g. `http://localhost:11434`)
 * @param model - Embedding model name (e.g. `nomic-embed-text`)
 * @param text - Text to generate an embedding for
 * @returns The embedding vector as an array of numbers
 */
export const generateEmbedding = async (
  ollamaUrl: string,
  model: string,
  text: string,
): Promise<number[]> => {
  let response: Response

  try {
    response = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to connect to Ollama at ${ollamaUrl}: ${message}`)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Ollama embedding failed (${response.status} ${response.statusText}): ${body}`,
    )
  }

  const data = (await response.json()) as { embeddings: number[][] }
  return data.embeddings[0]
}
