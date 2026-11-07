import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { INGESTION_MESSAGES } from "@/backend/ingestion/errors";
import { processSource } from "@/backend/ingestion/pipeline";
import { createNotebook } from "@/backend/notebooks/service";
import { createPdfUpload, listSources } from "@/backend/sources/service";
import { makePdf } from "@tests/helpers/pdf";
import { createTestUser, fakeEmbedder, fakeEmbedding, type TestUser } from "@tests/helpers/supabase";

const sentence = (page: number, n: number) => `Seite ${page} Satz ${n}: Die Bäckerei Sonnenkorn plant eine neue Filiale.`;
const pageText = (page: number, sentences = 30) =>
  Array.from({ length: sentences }, (_, i) => sentence(page, i + 1)).join(" ");

// US-04 und US-05 gegen die echte Datenbank, mit Fake-Embeddings statt Workers AI
describe("PDF-Verarbeitung", () => {
  let user: TestUser;
  let notebookId: string;

  beforeAll(async () => {
    user = await createTestUser("ingestion");
    notebookId = (await createNotebook(user.client, "Pipeline-Test")).id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  // Die Tests simulieren absichtlich Fehler. Log-Ausgaben werden abgefangen und geprüft,
  // statt das Build-Log mit erwarteten Stack-Traces zu füllen.
  let errorLog: MockInstance<typeof console.error>;
  beforeEach(() => {
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function upload(content: Uint8Array | string, fileName = "test.pdf") {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const ticket = await createPdfUpload(user.client, user.id, notebookId, {
      fileName,
      size: bytes.byteLength,
      type: "application/pdf",
    });
    const { error } = await user.client.storage
      .from("sources")
      .uploadToSignedUrl(ticket.path, ticket.token, new Blob([bytes as BlobPart], { type: "application/pdf" }));
    if (error) throw error;
    return ticket.sourceId;
  }

  const status = async (sourceId: string) =>
    (await listSources(user.client, notebookId)).find((s) => s.id === sourceId)!;

  const chunksOf = async (sourceId: string) => {
    const { data, error } = await user.client
      .from("chunks")
      .select("chunk_index, page_number, content, token_count")
      .eq("source_id", sourceId)
      .order("chunk_index");
    if (error) throw error;
    return data;
  };

  const deps = { supabase: undefined as never, embed: fakeEmbedder, chunkOptions: { maxChars: 800, overlapChars: 100 } };
  const run = (sourceId: string, embed = fakeEmbedder) =>
    processSource({ ...deps, supabase: user.client, embed }, sourceId);

  it("US-04: verarbeitet ein PDF zu Chunks mit Seitenzahlen und setzt den Status auf ready", async () => {
    const sourceId = await upload(await makePdf([pageText(1), pageText(2), pageText(3)]));
    expect((await status(sourceId)).status).toBe("uploaded");

    const result = await run(sourceId);

    expect(result).toMatchObject({ status: "ready", pageCount: 3 });
    expect(await status(sourceId)).toMatchObject({ status: "ready", pageCount: 3, error: null });

    const chunks = await chunksOf(sourceId);
    expect(chunks.length).toBe((result as { chunkCount: number }).chunkCount);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
    expect(new Set(chunks.map((c) => c.page_number))).toEqual(new Set([1, 2, 3]));
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(800);
      expect(chunk.content).toContain(`Seite ${chunk.page_number} Satz`);
      expect(chunk.token_count).toBe(Math.ceil(chunk.content.length / 4));
    }
    // Kein Satz geht verloren
    expect(chunks.some((c) => c.content.includes(sentence(2, 30)))).toBe(true);
  });

  it("US-04: die Suche findet den passenden Chunk über match_chunks", async () => {
    const sourceId = await upload(await makePdf(["Der Holzofen senkt den Gasverbrauch um 30 Prozent.", pageText(2, 5)]));
    await run(sourceId);
    const [target] = (await chunksOf(sourceId)).filter((c) => c.page_number === 1);

    const { data, error } = await user.client.rpc("match_chunks", {
      query_embedding: JSON.stringify(fakeEmbedding(target.content)),
      source_ids: [sourceId],
      match_count: 3,
    });

    expect(error).toBeNull();
    expect(data![0]).toMatchObject({ source_id: sourceId, page_number: 1, content: target.content });
    expect(data![0].similarity).toBeCloseTo(1, 5);
    // absteigend nach Ähnlichkeit sortiert
    const similarities = data!.map((d) => d.similarity);
    expect([...similarities].sort((a, b) => b - a)).toEqual(similarities);
  });

  it("US-04: erkennt gescannte PDFs und meldet den Grund", async () => {
    const sourceId = await upload(await makePdf(["", ""]), "scan.pdf");

    const result = await run(sourceId);

    expect(result).toEqual({ status: "failed", error: INGESTION_MESSAGES.scanned });
    expect(await status(sourceId)).toMatchObject({ status: "failed", error: INGESTION_MESSAGES.scanned });
    expect(await chunksOf(sourceId)).toEqual([]);
  });

  it("US-04: meldet kaputte Dateien verständlich", async () => {
    const sourceId = await upload("%PDF-1.4 das ist kein echtes PDF", "kaputt.pdf");
    expect(await run(sourceId)).toEqual({ status: "failed", error: INGESTION_MESSAGES.invalid });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("US-04: meldet eine fehlende Datei (Upload abgebrochen)", async () => {
    const ticket = await createPdfUpload(user.client, user.id, notebookId, {
      fileName: "nie-hochgeladen.pdf",
      size: 1000,
      type: "application/pdf",
    });
    expect(await run(ticket.sourceId)).toEqual({ status: "failed", error: INGESTION_MESSAGES.missing });
  });

  it("US-04: meldet das Tageslimit von Workers AI und speichert keine halben Chunks", async () => {
    const sourceId = await upload(await makePdf([pageText(1)]));
    const quotaEmbedder = async () => {
      throw new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons");
    };

    const result = await run(sourceId, quotaEmbedder);

    expect(result).toEqual({ status: "failed", error: INGESTION_MESSAGES.quota });
    expect(await chunksOf(sourceId)).toEqual([]);
    // Erwartbarer Fehler: steht an der Quelle, gehört nicht ins Fehler-Log
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("US-04: 'Erneut verarbeiten' nach einem Fehler klappt und verdoppelt keine Chunks", async () => {
    const sourceId = await upload(await makePdf([pageText(1), pageText(2)]));
    let calls = 0;
    const flaky = async (texts: string[]) => {
      calls++;
      if (calls === 1) throw new Error("fetch failed");
      return fakeEmbedder(texts);
    };

    expect((await run(sourceId, flaky)).status).toBe("failed");
    expect((await status(sourceId)).error).toBe(INGESTION_MESSAGES.generic);
    // Unerwarteter Fehler: wird mit Quellen-ID geloggt
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toContain(sourceId);

    const retry = await run(sourceId, flaky);
    expect(retry.status).toBe("ready");
    const firstCount = (await chunksOf(sourceId)).length;

    // Eine fertige Quelle wird nicht noch einmal verarbeitet.
    const again = await run(sourceId, flaky);
    expect(again).toMatchObject({ status: "ready", chunkCount: firstCount });
    expect(calls).toBe(2);
    expect(await chunksOf(sourceId)).toHaveLength(firstCount);
  });

  it("US-05: eine laufende Verarbeitung wird nicht doppelt gestartet", async () => {
    const sourceId = await upload(await makePdf([pageText(1)]));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = async (texts: string[]) => {
      await gate;
      return fakeEmbedder(texts);
    };

    const first = run(sourceId, slow);
    // Warten, bis der erste Lauf den Status auf processing gesetzt hat
    for (let i = 0; i < 50 && (await status(sourceId)).status !== "processing"; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect((await status(sourceId)).status).toBe("processing");

    const second = await run(sourceId, slow);
    expect(second).toEqual({ status: "processing", skipped: true });

    release();
    expect((await first).status).toBe("ready");
  });

  it("lehnt unbekannte Quellen ab", async () => {
    await expect(run("00000000-0000-4000-8000-000000000000")).rejects.toThrow("Quelle wurde nicht gefunden.");
  });
});
