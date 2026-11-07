import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { processSource } from "@/backend/ingestion/pipeline";
import { createNote, deleteNote, listNotes, noteToSource, updateNote } from "@/backend/notes/service";
import { createNotebook, deleteNotebook } from "@/backend/notebooks/service";
import { listSources } from "@/backend/sources/service";
import { prepareStudio } from "@/backend/studio/service";
import { collectText, createReadyPdfSource, fakeLlm } from "@tests/helpers/fixtures";
import { createTestUser, fakeEmbedder, type TestUser } from "@tests/helpers/supabase";

// US-15 bis US-19 gegen die echte Datenbank, mit Fake-Modell und Fake-Embeddings
describe("Studio und Notizen", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;
  let reportId: string;
  let protocolId: string;

  beforeAll(async () => {
    user = await createTestUser("studio");
    other = await createTestUser("studio-other");
    notebookId = (await createNotebook(user.client, "Studio-Test")).id;
    reportId = await createReadyPdfSource(
      user.client,
      user.id,
      notebookId,
      ["Im Jahr 2025 stieg der Umsatz der Bäckerei auf 4,2 Mio. Euro.", "2026 eröffnet die Filiale Nord."],
      { fileName: "Jahresbericht.pdf" },
    );
    protocolId = await createReadyPdfSource(user.client, user.id, notebookId, ["Protokoll: Die Sitzung im Mai beschloss neue Öffnungszeiten."], {
      fileName: "Protokoll.pdf",
    });
    await user.client
      .from("sources")
      .update({ summary: "Bericht über Umsatz und Filialen.", key_topics: ["Umsatz", "Filiale Nord"], summary_status: "ready" })
      .eq("id", reportId);
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  it("US-15: erzeugt eine Studio-Ausgabe aus Zusammenfassungen und Abschnitten und speichert sie", async () => {
    const { llm, streamed } = fakeLlm("**Wie hoch war der Umsatz?**\n4,2 Mio. Euro [1].");
    const prepared = await prepareStudio({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
      kind: "faq",
      sourceIds: [reportId],
    });
    const content = await collectText(prepared.stream);
    const noteId = await prepared.finish(content);

    const request = streamed[0];
    expect(request.usageKind).toBe("studio");
    expect(request.instructions).toContain("FAQ");
    const prompt = request.messages[0].content;
    expect(prompt).toContain("- Jahresbericht (Themen: Umsatz, Filiale Nord): Bericht über Umsatz und Filialen.");
    expect(prompt).toContain("[1] (Jahresbericht, Seite");
    expect(prompt).not.toContain("Protokoll");

    const [note] = (await listNotes(user.client, notebookId)).filter((n) => n.id === noteId);
    expect(note).toMatchObject({ kind: "faq", title: "FAQ: Jahresbericht", content, sourceIds: [reportId] });
    expect(note.citations).toEqual(prepared.citations);
    expect(note.citations[0]).toMatchObject({ n: 1, sourceId: reportId });
  });

  it("US-15: nimmt mehrere ausgewählte Quellen und Quellen ohne Zusammenfassung", async () => {
    const { llm, streamed } = fakeLlm("Briefing.");
    const prepared = await prepareStudio({ supabase: user.client, embed: fakeEmbedder, llm }, notebookId, {
      kind: "briefing",
      sourceIds: [reportId, protocolId],
    });
    await collectText(prepared.stream);
    expect(prepared.title).toBe("Briefing: Jahresbericht, Protokoll");
    expect(streamed[0].messages[0].content).toContain("- Protokoll: keine Zusammenfassung vorhanden");
  });

  it("US-15: fremde Nutzer und fremde Quellen sind ausgeschlossen", async () => {
    const { llm, streamed } = fakeLlm();
    await expect(
      prepareStudio({ supabase: other.client, embed: fakeEmbedder, llm }, notebookId, { kind: "faq", sourceIds: [reportId] }),
    ).rejects.toThrow("Notebook wurde nicht gefunden.");
    expect(streamed).toHaveLength(0);
  });

  it("US-17/US-18: eigene Notizen anlegen, bearbeiten und löschen", async () => {
    const note = await createNote(user.client, notebookId, {
      title: "Wie hoch war der Umsatz?",
      content: "4,2 Mio. Euro [1].",
      citations: [{ n: 1, chunkId: "x", sourceId: reportId, sourceTitle: "Jahresbericht", pageNumber: 1, excerpt: "…" }],
    });
    expect(note).toMatchObject({ kind: "note", title: "Wie hoch war der Umsatz?" });

    const updated = await updateNote(user.client, note.id, { title: "Umsatz 2025", content: "4,2 Mio. Euro." });
    expect(updated).toMatchObject({ title: "Umsatz 2025", content: "4,2 Mio. Euro." });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(note.updatedAt).getTime());

    await deleteNote(user.client, note.id);
    expect((await listNotes(user.client, notebookId)).some((n) => n.id === note.id)).toBe(false);
  });

  it("Studio-Ausgaben lassen sich nicht bearbeiten, nur neu erzeugen", async () => {
    const faq = (await listNotes(user.client, notebookId)).find((n) => n.kind === "faq")!;
    await expect(updateNote(user.client, faq.id, { title: "x", content: "y" })).rejects.toThrow("Notiz wurde nicht gefunden.");
  });

  it("andere Nutzer sehen, ändern und löschen keine fremden Notizen", async () => {
    const note = await createNote(user.client, notebookId, { title: "Privat", content: "Geheim" });
    expect(await listNotes(other.client, notebookId)).toEqual([]);
    await expect(updateNote(other.client, note.id, { title: "x", content: "y" })).rejects.toThrow("Notiz wurde nicht gefunden.");
    await expect(deleteNote(other.client, note.id)).rejects.toThrow("Notiz wurde nicht gefunden.");
    await expect(createNote(other.client, notebookId, { title: "Fremd", content: "x" })).rejects.toThrow(
      "Notebook wurde nicht gefunden.",
    );
  });

  it("US-19: macht aus einer Notiz eine Text-Quelle ohne Zitat-Marker", async () => {
    const note = await createNote(user.client, notebookId, {
      title: "Erkenntnisse",
      content: "Der Umsatz stieg deutlich [1]. Die Filiale Nord eröffnet 2026 [2, 3].",
    });
    const { sourceId } = await noteToSource(user.client, user.id, note.id);
    expect(await processSource({ supabase: user.client, embed: fakeEmbedder }, sourceId)).toMatchObject({ status: "ready" });

    const source = (await listSources(user.client, notebookId)).find((s) => s.id === sourceId)!;
    expect(source).toMatchObject({ title: "Erkenntnisse", type: "text" });
    const { data } = await user.client.from("chunks").select("content").eq("source_id", sourceId);
    expect(data![0].content).toBe("Der Umsatz stieg deutlich. Die Filiale Nord eröffnet 2026.");
  });

  it("Löschen des Notebooks löscht auch alle Notizen", async () => {
    const tmp = (await createNotebook(user.client, "Temporär")).id;
    const note = await createNote(user.client, tmp, { title: "Weg", content: "Text" });
    await deleteNotebook(user.client, tmp);
    const { data } = await user.client.from("notes").select("id").eq("id", note.id);
    expect(data).toEqual([]);
  });
});
