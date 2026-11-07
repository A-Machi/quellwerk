import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { retrieveChunks } from "@/backend/chat/service";
import { createNotebook } from "@/backend/notebooks/service";
import { listSources } from "@/backend/sources/service";
import { summarizeSource } from "@/backend/sources/summary";
import { createReadyPdfSource, fakeLlm } from "@tests/helpers/fixtures";
import { createTestUser, fakeEmbedder, fakeEmbedding, type TestUser } from "@tests/helpers/supabase";

const filler = (page: number) =>
  Array.from({ length: 12 }, (_, i) => `Seite ${page}, Absatz ${i}: Allgemeine Hinweise zur sicheren Nutzung von Sprachmodellen.`).join(" ");

// US-14 (Zusammenfassung) und US-20 (Hybrid-Suche) gegen die echte Datenbank
describe("Zusammenfassung und Hybrid-Suche", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;
  let sourceId: string;

  beforeAll(async () => {
    user = await createTestUser("summary");
    other = await createTestUser("summary-other");
    notebookId = (await createNotebook(user.client, "Phase-2-Test")).id;
    const pages = Array.from({ length: 30 }, (_, i) => filler(i + 1));
    pages[17] = "LLM05 Improper Output Handling: Ausgaben des Modells werden ungeprüft an andere Systeme weitergegeben.";
    sourceId = await createReadyPdfSource(user.client, user.id, notebookId, pages, { fileName: "OWASP-Test.pdf" });
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  it("US-20: findet einen exakten Begriff, den die Vektorsuche allein verpasst", async () => {
    // Fake-Embeddings sind zufällig: die reine Vektorsuche findet den Abschnitt nicht gezielt.
    const query = "Was steht zu LLM05?";
    const { data: vectorOnly } = await user.client.rpc("match_chunks", {
      query_embedding: JSON.stringify(fakeEmbedding(query)),
      source_ids: [sourceId],
      match_count: 3,
    });
    const hybrid = await retrieveChunks({ supabase: user.client, embed: fakeEmbedder }, query, [sourceId], 3);

    expect(hybrid[0]).toMatchObject({ pageNumber: 18 });
    expect(hybrid[0].content).toContain("LLM05");
    expect(vectorOnly!.some((c) => c.content.includes("LLM05"))).toBe(false);
  });

  it("US-20: Füllwörter allein lösen keinen Volltext-Treffer aus, die Vektorsuche liefert trotzdem", async () => {
    const result = await retrieveChunks({ supabase: user.client, embed: fakeEmbedder }, "Was ist das?", [sourceId], 5);
    expect(result).toHaveLength(5);
  });

  it("US-14: erzeugt Zusammenfassung und Themen aus einer Auswahl und speichert sie", async () => {
    const fake = fakeLlm();
    fake.llm.complete = async (request) => {
      fake.completed.push(request);
      return "ZUSAMMENFASSUNG:\nDas Dokument erklärt Risiken von Sprachmodellen.\nTHEMEN:\n- Output Handling\n- Sichere Nutzung";
    };

    const result = await summarizeSource({ supabase: user.client, llm: fake.llm }, sourceId);

    expect(result).toEqual({
      status: "ready",
      summary: "Das Dokument erklärt Risiken von Sprachmodellen.",
      topics: ["Output Handling", "Sichere Nutzung"],
    });
    const source = (await listSources(user.client, notebookId)).find((s) => s.id === sourceId)!;
    expect(source).toMatchObject({
      summaryStatus: "ready",
      summary: "Das Dokument erklärt Risiken von Sprachmodellen.",
      keyTopics: ["Output Handling", "Sichere Nutzung"],
    });

    const request = fake.completed[0];
    expect(request.usageKind).toBe("summary");
    expect(request.messages[0].content).toContain("Quelle: OWASP-Test");
    expect(request.messages[0].content).toContain("[Seite 1]");
  });

  it("US-14: Tageslimit setzt den Status auf failed, die Quelle bleibt nutzbar", async () => {
    const fake = fakeLlm();
    fake.llm.complete = async () => {
      throw new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons");
    };
    expect(await summarizeSource({ supabase: user.client, llm: fake.llm }, sourceId)).toEqual({
      status: "failed",
      reason: "quota",
    });
    const source = (await listSources(user.client, notebookId)).find((s) => s.id === sourceId)!;
    expect(source).toMatchObject({ status: "ready", summaryStatus: "failed" });
  });

  it("US-14: fremde Nutzer können keine Zusammenfassung erzeugen", async () => {
    const { llm } = fakeLlm();
    await expect(summarizeSource({ supabase: other.client, llm }, sourceId)).rejects.toThrow(
      "Quelle wurde nicht gefunden oder ist noch nicht verarbeitet.",
    );
  });
});
