import "server-only";

import { embedMany } from "ai";

import { getEmbeddingModel } from "@/backend/ai/provider";
import { estimateNeurons, PRICES, type UsageRecorder } from "@/backend/ai/usage";
import { estimateTokens } from "@/backend/ingestion/chunker";

// bge-m3 liefert 1024 Dimensionen, passend zu chunks.embedding vector(1024)
export const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 32;

export type Embedder = (texts: string[]) => Promise<number[][]>;

export function createWorkersAiEmbedder(recordUsage?: UsageRecorder): Embedder {
  const model = getEmbeddingModel();

  return async (texts) => {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const { embeddings } = await embedMany({
        model,
        values: texts.slice(i, i + BATCH_SIZE),
        maxRetries: 2,
      });
      vectors.push(...embeddings);
    }
    // Workers AI meldet bei Embeddings keinen Verbrauch: aus der Textlänge schätzen.
    if (recordUsage) {
      const tokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
      await recordUsage("embedding", estimateNeurons({ input: tokens }, PRICES.embedding), true);
    }
    return vectors;
  };
}

export function assertEmbeddings(vectors: number[][], expectedCount: number): void {
  if (vectors.length !== expectedCount) {
    throw new Error(`Erwartet ${expectedCount} Embeddings, erhalten ${vectors.length}`);
  }
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding hat ${vector.length} statt ${EMBEDDING_DIMENSIONS} Dimensionen`);
    }
  }
}
