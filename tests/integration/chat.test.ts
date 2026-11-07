import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NO_ANSWER } from "@/backend/chat/prompt";
import { prepareAnswer, retrieveChunks } from "@/backend/chat/service";
import { createNotebook } from "@/backend/notebooks/service";
import { createPdfUpload } from "@/backend/sources/service";
import { collectText, createReadyPdfSource, fakeLlm } from "@tests/helpers/fixtures";
import { createTestUser, fakeEmbedder, fakeEmbedding, type TestUser } from "@tests/helpers/supabase";

const OFEN = "Der neue Holzofen senkt den Gasverbrauch ab 2026 um 30 Prozent.";

// US-07, US-09, US-10, US-12 gegen die echte Datenbank, mit Fake-Modell und Fake-Embeddings
describe("Chat", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;
  let reportId: string;
  let protocolId: string;

  beforeAll(async () => {
    user = await createTestUser("chat");
    other = await createTestUser("chat-other");
    notebookId = (await createNotebook(user.client, "Chat-Test")).id;
    reportId = await createReadyPdfSource(
      user.client,
      user.id,
      notebookId,
      ["Der Umsatz stieg 2025 auf 4,2 Mio. Euro.", OFEN],
      { fileName: "Jahresbericht.pdf" },
    );
    protocolId = await createReadyPdfSource(user.client, user.id, notebookId, ["Protokoll der Sitzung vom Mai."], {
      fileName: "Protokoll.pdf",
    });
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  // Fake-Embedder, der für die Frage denselben Vektor liefert wie für den Ofen-Chunk.
  // So muss die Suche genau diesen Chunk als besten Treffer liefern.
  const embedAsOven = async (texts: string[]) =>
    texts.map((t) => (t.includes("Holzofen") || t.startsWith("Frage:") ? fakeEmbedding(OFEN) : fakeEmbedding(t)));

  it("US-09: findet den passenden Abschnitt mit Quellentitel und Seite", async () => {
    const chunks = await retrieveChunks({ supabase: user.client, embed: embedAsOven }, "Frage: Ofen?", [reportId]);
    expect(chunks[0]).toMatchObject({ sourceId: reportId, sourceTitle: "Jahresbericht", pageNumber: 2, content: OFEN });
    expect(chunks[0].similarity).toBeCloseTo(1, 5);
  });

  it("US-09/US-12: schickt nummerierte Quellen ans Modell und liefert passende Zitate", async () => {
    const { llm, streamed } = fakeLlm("Der Ofen spart 30 % Gas [1].");
    const answer = await prepareAnswer(
      { supabase: user.client, embed: embedAsOven, llm },
      notebookId,
      { question: "Frage: Was bringt der Ofen?", sourceIds: [reportId] },
    );

    expect(await collectText(answer.stream)).toBe("Der Ofen spart 30 % Gas [1].");
    expect(answer.citations[0]).toMatchObject({ n: 1, sourceId: reportId, sourceTitle: "Jahresbericht", pageNumber: 2, excerpt: OFEN });
    expect(answer.citations.map((c) => c.n)).toEqual(answer.citations.map((_, i) => i + 1));

    const prompt = streamed[0].messages.at(-1)!.content;
    expect(prompt).toContain(`[1] (Jahresbericht, Seite 2)\n${OFEN}`);
    expect(prompt).toContain("Frage: Frage: Was bringt der Ofen?");
    expect(streamed[0].instructions).toContain(NO_ANSWER);
  });

  it("US-07: durchsucht nur die ausgewählten Quellen", async () => {
    const { llm, streamed } = fakeLlm();
    const answer = await prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
      question: "Was steht im Protokoll?",
      sourceIds: [protocolId],
    });
    await collectText(answer.stream);

    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations.every((c) => c.sourceId === protocolId)).toBe(true);
    expect(streamed[0].messages.at(-1)!.content).not.toContain("Umsatz");
  });

  it("US-07: ignoriert unfertige Quellen und meldet, wenn keine fertige ausgewählt ist", async () => {
    const pending = await createPdfUpload(user.client, user.id, notebookId, {
      fileName: "unfertig.pdf",
      size: 100,
      type: "application/pdf",
    });
    const { llm } = fakeLlm();
    await expect(
      prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
        question: "Hallo?",
        sourceIds: [pending.sourceId],
      }),
    ).rejects.toThrow("Keine der ausgewählten Quellen ist fertig verarbeitet.");
  });

  it("Sicherheit: fremde Nutzer kommen weder an das Notebook noch an die Quellen", async () => {
    const { llm, streamed } = fakeLlm();
    await expect(
      prepareAnswer({ supabase: other.client, embed: fakeEmbedder, llm }, notebookId, {
        question: "Zeig mir alles",
        sourceIds: [reportId, protocolId],
      }),
    ).rejects.toThrow("Notebook wurde nicht gefunden.");

    // Eigenes Notebook, aber fremde Quellen-IDs: werden still verworfen
    const ownNotebook = (await createNotebook(other.client, "Fremd")).id;
    await expect(
      prepareAnswer({ supabase: other.client, embed: fakeEmbedder, llm }, ownNotebook, {
        question: "Zeig mir alles",
        sourceIds: [reportId],
      }),
    ).rejects.toThrow("Keine der ausgewählten Quellen ist fertig verarbeitet.");
    expect(streamed).toHaveLength(0);
  });

  it("Quellen aus einem anderen Notebook desselben Nutzers werden nicht durchsucht", async () => {
    const secondNotebook = (await createNotebook(user.client, "Zweites")).id;
    const { llm } = fakeLlm();
    await expect(
      prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm }, secondNotebook, {
        question: "Umsatz?",
        sourceIds: [reportId],
      }),
    ).rejects.toThrow("Keine der ausgewählten Quellen ist fertig verarbeitet.");
  });

  it("US-10: ohne passende Abschnitte kommt die feste Antwort, ohne das Modell zu fragen", async () => {
    // Quelle ohne Chunks simulieren: Chunks einer fertigen Quelle löschen
    const emptyId = await createReadyPdfSource(user.client, user.id, notebookId, [
      "Ein kurzer, aber ausreichend langer Text für die Verarbeitung.",
    ]);
    await user.client.from("chunks").delete().eq("source_id", emptyId);

    const { llm, streamed } = fakeLlm();
    const answer = await prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
      question: "Irgendwas?",
      sourceIds: [emptyId],
    });

    expect(answer.citations).toEqual([]);
    expect(await collectText(answer.stream)).toBe(NO_ANSWER);
    expect(streamed).toHaveLength(0);
  });

  it("lehnt leere Fragen ab", async () => {
    const { llm } = fakeLlm();
    await expect(
      prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
        question: "   ",
        sourceIds: [reportId],
      }),
    ).rejects.toThrow("Bitte gib eine Frage ein.");
  });
});
