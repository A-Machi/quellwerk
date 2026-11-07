import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { NO_ANSWER } from "@/backend/chat/prompt";
import { prepareAnswer } from "@/backend/chat/service";
import { createNotebook } from "@/backend/notebooks/service";
import { citedNumbers } from "@/frontend/lib/citations";
import { collectText, createReadyPdfSource } from "@tests/helpers/fixtures";
import { createTestUser, type TestUser } from "@tests/helpers/supabase";

// Echter Chat mit Workers AI (gpt-oss-20b + bge-m3). Kostet ca. 150 Neurons, darum nur auf Wunsch:
//   RUN_AI_TESTS=1 npm run test:integration
describe.runIf(process.env.RUN_AI_TESTS === "1")("Chat mit echtem Modell", () => {
  let user: TestUser;
  let notebookId: string;
  let sourceId: string;
  const deps = () => ({ supabase: user.client, embed: createWorkersAiEmbedder(), llm: createWorkersAiLlm() });

  beforeAll(async () => {
    user = await createTestUser("chat-ai");
    notebookId = (await createNotebook(user.client, "KI-Test")).id;
    sourceId = await createReadyPdfSource(
      user.client,
      user.id,
      notebookId,
      [
        "Jahresbericht der Bäckerei Sonnenkorn. Im Jahr 2025 stieg der Umsatz auf 4,2 Mio. Euro, ein Plus von 12 Prozent. Treiber war das neue Café in der Altstadt.",
        "Die Zahl der Mitarbeitenden wuchs von 38 auf 45. Größtes Risiko bleiben die Energiepreise. Der neue Holzofen soll den Gasverbrauch ab 2026 um 30 Prozent senken.",
      ],
      { fileName: "Sonnenkorn.pdf", embed: createWorkersAiEmbedder() },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it("US-09/US-12: beantwortet eine Frage aus der Quelle und belegt sie", async () => {
    const answer = await prepareAnswer(deps(), notebookId, {
      question: "Wie hoch war der Umsatz 2025 und warum ist er gestiegen?",
      sourceIds: [sourceId],
    });
    const text = await collectText(answer.stream);

    expect(text).toMatch(/4,2/);
    expect(citedNumbers(text, new Set(answer.citations.map((c) => c.n))).length).toBeGreaterThan(0);
  });

  // US-10: "Mit 5 Testfragen geprüft, deren Antwort nicht in den Quellen steht"
  it.each([
    "Wer ist der Geschäftsführer der Bäckerei?",
    "Wie lautet die Adresse des Cafés?",
    "Wie viel kostet ein Roggenbrot?",
    "Welche Partei hat die letzte Bundestagswahl gewonnen?",
    "Wie hoch war der Gewinn im Jahr 2023?",
  ])("US-10: sagt ehrlich, dass nichts in den Quellen steht: %s", async (question) => {
    const answer = await prepareAnswer(deps(), notebookId, { question, sourceIds: [sourceId] });
    const text = await collectText(answer.stream);
    expect(text).toContain(NO_ANSWER.replace(/\.$/, ""));
  });
});
