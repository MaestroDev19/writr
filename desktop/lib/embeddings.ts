import { OllamaEmbeddings } from "@langchain/ollama"

import { EMBED_MODEL, OLLAMA_BASE_URL } from "@/lib/setup"

/** nomic-embed-text vector length. Index and query must both use this model. */
export const EMBED_DIM = 768

/**
 * Local embedder. Chat stays on a separate tool-calling model.
 * Ollama must already be running and `nomic-embed-text` must be pulled.
 */
export function createEmbedder(): OllamaEmbeddings {
  return new OllamaEmbeddings({
    model: EMBED_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  })
}

export async function embedQuery(text: string): Promise<number[]> {
  const vector = await createEmbedder().embedQuery(text)
  assertEmbedDim(vector)
  return vector
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const vectors = await createEmbedder().embedDocuments(texts)
  for (const vector of vectors) assertEmbedDim(vector)
  return vectors
}

function assertEmbedDim(vector: number[]): void {
  if (vector.length !== EMBED_DIM) {
    throw new Error(`${EMBED_MODEL} returned ${vector.length} dimensions. Expected ${EMBED_DIM}.`)
  }
}
