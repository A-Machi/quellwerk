import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import type { UsageKind } from "@/backend/ai/usage";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { createNotebook } from "@/backend/notebooks/service";
import { summarizeSource } from "@/backend/sources/summary";
import { prepareStudio } from "@/backend/studio/service";
import { citedNumbers } from "@/frontend/lib/citations";
import { collectText, createReadyPdfSource } from "@tests/helpers/fixtures";
import { createTestUser, type TestUser } from "@tests/helpers/supabase";

// Echte Studio-Ausgabe (FAQ) mit gpt-oss-20b, misst den Verbrauch (V-07). Nur auf Wunsch:
//   RUN_AI_TESTS=1 npm run test:integration
describe.runIf(process.env.RUN_AI_TESTS === "1")("Studio mit echtem Modell", () => {
  let user: TestUser;
  let notebookId: string;
  let sourceId: string;
  const usage: { kind: UsageKind; neurons: number }[] = [];
  const record = async (kind: UsageKind, neurons: number) => {
    usage.push({ kind, neurons });
  };

  beforeAll(async () => {
    user = await createTestUser("studio-ai");
    notebookId = (await createNotebook(user.client, "Studio-KI")).id;
    sourceId = await createReadyPdfSource(
      user.client,
      user.id,
      notebookId,
      [
        "Jahresbericht der Bäckerei Sonnenkorn 2025. Der Umsatz stieg auf 4,2 Mio. Euro, ein Plus von 12 Prozent. Treiber war das neue Café in der Altstadt, das im März 2025 eröffnete.",
        "Die Zahl der Mitarbeitenden wuchs von 38 auf 45. Im Juni 2025 wurde ein Holzofen bestellt, der den Gasverbrauch ab 2026 um 30 Prozent senken soll.",
        "Für 2026 plant die Geschäftsführung eine zweite Filiale in Kleinstadt-Nord. Größtes Risiko bleiben die Energiepreise.",
      ],
      { fileName: "Sonnenkorn-2025.pdf", embed: createWorkersAiEmbedder(record) },
    );
    await summarizeSource({ supabase: user.client, llm: createWorkersAiLlm(record) }, sourceId);
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it("US-15/V-07: erzeugt ein FAQ mit Fragen und Belegen", async () => {
    const prepared = await prepareStudio(
      { supabase: user.client, embed: createWorkersAiEmbedder(record), llm: createWorkersAiLlm(record) },
      notebookId,
      { kind: "faq", sourceIds: [sourceId] },
    );
    const content = await collectText(prepared.stream);

    expect((content.match(/\?/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(content).toMatch(/4,2/);
    expect(citedNumbers(content, new Set(prepared.citations.map((c) => c.n))).length).toBeGreaterThan(0);

    const studio = usage.find((u) => u.kind === "studio")!;
    expect(studio.neurons).toBeGreaterThan(5);
    console.info(`V-07 Messung: Studio-FAQ ${studio.neurons.toFixed(1)} Neurons`);
  });
});
