import { describe, expect, it } from "vitest";

import { createWorkersAiEmbedder, EMBEDDING_DIMENSIONS } from "@/backend/ai/embeddings";

// Echter Aufruf von Workers AI. Verbraucht ein paar Neurons, darum nur auf Wunsch:
//   RUN_AI_TESTS=1 npm run test:integration
describe.runIf(process.env.RUN_AI_TESTS === "1")("Workers AI (echt)", () => {
  it("liefert für jeden Text ein Embedding mit 1024 Dimensionen, auch über mehrere Batches", async () => {
    const texts = Array.from({ length: 40 }, (_, i) => `Testsatz ${i}: Der Umsatz stieg auf 4,2 Mio. Euro.`);
    const vectors = await createWorkersAiEmbedder()(texts);

    expect(vectors).toHaveLength(40);
    for (const vector of vectors) expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("ähnliche Sätze liegen näher beieinander als unähnliche", async () => {
    const [umsatz, erloes, wetter] = await createWorkersAiEmbedder()([
      "Der Umsatz der Bäckerei stieg deutlich.",
      "Die Erlöse des Bäckereibetriebs nahmen stark zu.",
      "Morgen regnet es in Hamburg.",
    ]);
    const cosine = (a: number[], b: number[]) => {
      const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
      const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
      return dot / (norm(a) * norm(b));
    };
    expect(cosine(umsatz, erloes)).toBeGreaterThan(cosine(umsatz, wetter));
  });
});
