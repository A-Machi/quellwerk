import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import type { UsageKind } from "@/backend/ai/usage";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { createNotebook } from "@/backend/notebooks/service";
import { summarizeSource } from "@/backend/sources/summary";
import { createReadyPdfSource } from "@tests/helpers/fixtures";
import { createTestUser, type TestUser } from "@tests/helpers/supabase";

const page = (n: number) =>
  `Kapitel ${n}. ` +
  Array.from(
    { length: 14 },
    (_, i) =>
      `Die Bäckerei Sonnenkorn erweitert im Jahr ${2020 + (n % 6)} ihr Angebot um Sauerteigbrot Nummer ${i}, investiert in einen Holzofen und schult das Team in Hygiene und Kundenservice.`,
  ).join(" ");

// Echte Zusammenfassung mit gpt-oss-20b, misst den Verbrauch (V-07). Nur auf Wunsch:
//   RUN_AI_TESTS=1 npm run test:integration
describe.runIf(process.env.RUN_AI_TESTS === "1")("Zusammenfassung mit echtem Modell", () => {
  let user: TestUser;
  let sourceId: string;
  const usage: { kind: UsageKind; neurons: number; estimated: boolean }[] = [];
  const record = async (kind: UsageKind, neurons: number, estimated: boolean) => {
    usage.push({ kind, neurons, estimated });
  };

  beforeAll(async () => {
    user = await createTestUser("summary-ai");
    const notebookId = (await createNotebook(user.client, "Zusammenfassung")).id;
    // ca. 40 Seiten zu je ca. 450 Token: größer als das Budget von 12.000 Token
    sourceId = await createReadyPdfSource(user.client, user.id, notebookId, Array.from({ length: 40 }, (_, i) => page(i + 1)), {
      fileName: "Sonnenkorn-Chronik.pdf",
      embed: createWorkersAiEmbedder(record),
    });
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it("US-14/V-07: erzeugt eine deutsche Zusammenfassung mit Themen und meldet den echten Verbrauch", async () => {
    const result = await summarizeSource({ supabase: user.client, llm: createWorkersAiLlm(record) }, sourceId);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.summary.length).toBeGreaterThan(80);
    expect(result.summary).toMatch(/Bäckerei|Sonnenkorn/);
    expect(result.topics.length).toBeGreaterThanOrEqual(3);

    const summaryUsage = usage.find((u) => u.kind === "summary")!;
    expect(summaryUsage.estimated).toBe(false);
    expect(summaryUsage.neurons).toBeGreaterThan(50);
    expect(summaryUsage.neurons).toBeLessThan(600);
    console.info(
      `V-07 Messung: Zusammenfassung ${summaryUsage.neurons.toFixed(1)} Neurons, Embeddings ${usage
        .filter((u) => u.kind === "embedding")
        .reduce((s, u) => s + u.neurons, 0)
        .toFixed(1)} Neurons (geschätzt)`,
    );
  });
});
