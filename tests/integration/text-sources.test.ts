import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { processSource } from "@/backend/ingestion/pipeline";
import { createNotebook, deleteNotebook } from "@/backend/notebooks/service";
import { createTextSource, getSourcePassage, listSources } from "@/backend/sources/service";
import { createReadyPdfSource } from "@tests/helpers/fixtures";
import { createTestUser, fakeEmbedder, type TestUser } from "@tests/helpers/supabase";

const NOTIZ = Array.from(
  { length: 30 },
  (_, i) => `Punkt ${i + 1}: Die Besprechung im Mai hat beschlossen, die Filiale Nord zu eröffnen.`,
).join("\n");

// US-08 (Text als Quelle) und US-13 (zitierte Stelle öffnen) gegen die echte Datenbank
describe("Text-Quellen und zitierte Stellen", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;

  beforeAll(async () => {
    user = await createTestUser("text");
    other = await createTestUser("text-other");
    notebookId = (await createNotebook(user.client, "Text-Test")).id;
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  const chunksOf = async (sourceId: string) =>
    (await user.client.from("chunks").select("id, page_number, content").eq("source_id", sourceId).order("chunk_index"))
      .data!;

  it("US-08: speichert eingefügten Text als .txt und verarbeitet ihn zu Chunks ohne Seitenzahl", async () => {
    const { sourceId } = await createTextSource(user.client, user.id, notebookId, {
      title: "  Besprechungsnotizen  ",
      text: NOTIZ,
    });

    const before = (await listSources(user.client, notebookId)).find((s) => s.id === sourceId)!;
    expect(before).toMatchObject({ title: "Besprechungsnotizen", type: "text", status: "uploaded" });

    const { data: file } = await user.client.storage.from("sources").download(`${user.id}/${notebookId}/${sourceId}.txt`);
    expect(await file!.text()).toBe(NOTIZ);

    const result = await processSource({ supabase: user.client, embed: fakeEmbedder }, sourceId);
    expect(result).toMatchObject({ status: "ready", pageCount: null });

    const chunks = await chunksOf(sourceId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.page_number === null)).toBe(true);
    expect(chunks.map((c) => c.content).join(" ")).toContain("Punkt 30: Die Besprechung");
  });

  it("US-08: lehnt zu kurzen Text und fremde Notebooks ab", async () => {
    await expect(createTextSource(user.client, user.id, notebookId, { title: "Kurz", text: "zu kurz" })).rejects.toThrow(
      "mindestens 20 Zeichen",
    );
    await expect(createTextSource(other.client, other.id, notebookId, { title: "Fremd", text: NOTIZ })).rejects.toThrow(
      "Notebook wurde nicht gefunden.",
    );
  });

  it("US-08: Löschen des Notebooks entfernt auch die .txt-Datei", async () => {
    const tmpNotebook = (await createNotebook(user.client, "Temporär")).id;
    const { sourceId } = await createTextSource(user.client, user.id, tmpNotebook, { title: "Weg", text: NOTIZ });
    await deleteNotebook(user.client, tmpNotebook);
    const { data } = await user.client.storage.from("sources").download(`${user.id}/${tmpNotebook}/${sourceId}.txt`);
    expect(data).toBeNull();
  });

  it("US-13: liefert zur zitierten Stelle eines PDFs Seite, Abschnitt und eine funktionierende Datei-URL", async () => {
    const pdfId = await createReadyPdfSource(
      user.client,
      user.id,
      notebookId,
      ["Erste Seite mit Einleitung und etwas Text.", "Zweite Seite: Der Holzofen spart 30 Prozent Gas."],
      { fileName: "Bericht.pdf" },
    );
    const page2 = (await chunksOf(pdfId)).find((c) => c.page_number === 2)!;

    const passage = await getSourcePassage(user.client, page2.id);

    expect(passage).toMatchObject({ sourceId: pdfId, sourceTitle: "Bericht", type: "pdf", pageNumber: 2, content: page2.content });
    const response = await fetch(passage.fileUrl!);
    expect(response.status).toBe(200);
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 4))).toBe("%PDF");
  });

  it("US-13: Text-Quellen liefern den Abschnitt ohne Datei-URL", async () => {
    const { sourceId } = await createTextSource(user.client, user.id, notebookId, { title: "Notiz 2", text: NOTIZ });
    await processSource({ supabase: user.client, embed: fakeEmbedder }, sourceId);
    const [chunk] = await chunksOf(sourceId);

    const passage = await getSourcePassage(user.client, chunk.id);
    expect(passage).toMatchObject({ type: "text", pageNumber: null, fileUrl: null, content: chunk.content });
  });

  it("US-13: fremde Nutzer bekommen weder Abschnitt noch Datei-URL", async () => {
    const { data } = await user.client.from("chunks").select("id").limit(1).single();
    await expect(getSourcePassage(other.client, data!.id)).rejects.toThrow("Textstelle wurde nicht gefunden.");
    await expect(getSourcePassage(other.client, "kein-uuid")).rejects.toThrow("Textstelle wurde nicht gefunden.");
  });
});
