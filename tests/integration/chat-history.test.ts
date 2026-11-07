import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clearMessages, listMessages, prepareAnswer } from "@/backend/chat/service";
import { createNotebook } from "@/backend/notebooks/service";
import { collectText, createReadyPdfSource, fakeLlm } from "@tests/helpers/fixtures";
import { createTestUser, fakeEmbedder, type TestUser } from "@tests/helpers/supabase";

// US-11: Chatverlauf, Folgefragen und "Chat leeren" gegen die echte Datenbank
describe("Chatverlauf", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;
  let sourceId: string;

  beforeAll(async () => {
    user = await createTestUser("history");
    other = await createTestUser("history-other");
    notebookId = (await createNotebook(user.client, "Verlauf-Test")).id;
    sourceId = await createReadyPdfSource(user.client, user.id, notebookId, [
      "Der Umsatz stieg 2025 auf 4,2 Mio. Euro. Treiber war das neue Café in der Altstadt.",
    ]);
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  async function ask(question: string, answer: string, rewrite?: string) {
    const embedded: string[] = [];
    const embed = async (texts: string[]) => {
      embedded.push(...texts);
      return fakeEmbedder(texts);
    };
    const fake = fakeLlm(answer, rewrite ? () => rewrite : undefined);
    const prepared = await prepareAnswer({ supabase: user.client, embed, llm: fake.llm }, notebookId, {
      question,
      sourceIds: [sourceId],
    });
    const text = await collectText(prepared.stream);
    const messageId = await prepared.finish(text);
    return { prepared, messageId, embedded, ...fake };
  }

  it("speichert Frage und Antwort samt Zitaten im Verlauf", async () => {
    const first = await ask("Wie hoch war der Umsatz?", "4,2 Mio. Euro [1].");

    // Erste Frage: kein Verlauf, also keine Umformulierung
    expect(first.completed).toHaveLength(0);
    expect(first.embedded).toEqual(["Wie hoch war der Umsatz?"]);

    const messages = await listMessages(user.client, notebookId);
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "Wie hoch war der Umsatz?"],
      ["assistant", "4,2 Mio. Euro [1]."],
    ]);
    expect(messages[1].id).toBe(first.messageId);
    expect(messages[1].citations[0]).toMatchObject({ n: 1, sourceId });
    expect(messages[1].citations).toEqual(first.prepared.citations);
  });

  it("formuliert Folgefragen mit dem Verlauf um und sucht mit der neuen Frage", async () => {
    const second = await ask("Und warum?", "Wegen des Cafés [1].", "Warum stieg der Umsatz 2025?");

    // Umformulieren bekommt den Verlauf ohne Zitat-Marker
    expect(second.completed).toHaveLength(1);
    const rewritePrompt = second.completed[0].messages[0].content;
    expect(rewritePrompt).toContain("Nutzer: Wie hoch war der Umsatz?");
    expect(rewritePrompt).toContain("Assistent: 4,2 Mio. Euro.");
    expect(rewritePrompt).toContain("Letzte Frage: Und warum?");

    // Gesucht wird mit der umformulierten Frage
    expect(second.prepared.searchQuery).toBe("Warum stieg der Umsatz 2025?");
    expect(second.embedded).toEqual(["Warum stieg der Umsatz 2025?"]);

    // Das Modell bekommt den Verlauf als Nachrichten und am Ende die Originalfrage mit Quellen
    const messages = second.streamed[0].messages;
    expect(messages.slice(0, 2)).toEqual([
      { role: "user", content: "Wie hoch war der Umsatz?" },
      { role: "assistant", content: "4,2 Mio. Euro." },
    ]);
    expect(messages.at(-1)!.content).toContain("Frage: Und warum?");
  });

  it("überlebt ein Neuladen: der Verlauf kommt vollständig und in Reihenfolge zurück", async () => {
    const messages = await listMessages(user.client, notebookId);
    expect(messages.map((m) => m.content)).toEqual([
      "Wie hoch war der Umsatz?",
      "4,2 Mio. Euro [1].",
      "Und warum?",
      "Wegen des Cafés [1].",
    ]);
  });

  it("sucht mit der Originalfrage, wenn das Umformulieren fehlschlägt", async () => {
    const fake = fakeLlm("Antwort [1].");
    fake.llm.complete = async () => {
      throw new Error("timeout");
    };
    const original = console.error;
    console.error = () => {};
    try {
      const prepared = await prepareAnswer({ supabase: user.client, embed: fakeEmbedder, llm: fake.llm }, notebookId, {
        question: "Und was noch?",
        sourceIds: [sourceId],
      });
      expect(prepared.searchQuery).toBe("Und was noch?");
      await prepared.finish(await collectText(prepared.stream));
    } finally {
      console.error = original;
    }
  });

  it("andere Nutzer sehen den Verlauf nicht und können ihn nicht leeren", async () => {
    expect(await listMessages(other.client, notebookId)).toEqual([]);
    await expect(clearMessages(other.client, notebookId)).rejects.toThrow("Notebook wurde nicht gefunden.");
    expect((await listMessages(user.client, notebookId)).length).toBeGreaterThan(0);
  });

  it("'Chat leeren' löscht alle Nachrichten des Notebooks, die Quellen bleiben", async () => {
    await clearMessages(user.client, notebookId);
    expect(await listMessages(user.client, notebookId)).toEqual([]);
    const { data } = await user.client.from("sources").select("id").eq("id", sourceId);
    expect(data).toHaveLength(1);
  });
});
