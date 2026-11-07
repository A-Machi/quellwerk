import "server-only";

import { assertEmbeddings, type Embedder } from "@/backend/ai/embeddings";
import { UserFacingError } from "@/backend/errors";
import { chunkPages, type ChunkOptions, type TextPage } from "@/backend/ingestion/chunker";
import {
  describeIngestionError,
  EmptyTextError,
  FileMissingError,
  INGESTION_MESSAGES,
  ScannedPdfError,
  TooManyPagesError,
} from "@/backend/ingestion/errors";
import { extractPdfPages, isLikelyScanned, normalizePageText } from "@/backend/ingestion/extract-pdf";
import { parseId } from "@/backend/notebooks/service";
import { SOURCES_BUCKET, type AppSupabaseClient, type SourceStatus } from "@/backend/supabase/types";

// Grenze, damit die Verarbeitung in der Laufzeit einer Vercel Function bleibt.
export const MAX_PDF_PAGES = 300;
const INSERT_BATCH_SIZE = 100;

export type IngestionDeps = {
  supabase: AppSupabaseClient;
  embed: Embedder;
  chunkOptions?: ChunkOptions;
};

export type ProcessResult =
  | { status: "ready"; pageCount: number | null; chunkCount: number }
  | { status: "failed"; error: string }
  | { status: Exclude<SourceStatus, "ready" | "failed">; skipped: true };

// Verarbeitet eine hochgeladene Quelle: Datei laden, Text (bei PDFs seitenweise) extrahieren,
// in Chunks teilen, Embeddings erzeugen und speichern.
// Status: uploaded/failed -> processing -> ready | failed
export async function processSource(deps: IngestionDeps, id: string): Promise<ProcessResult> {
  const { supabase } = deps;
  const sourceId = parseId(id, "Quelle");

  // Nur eine Verarbeitung gleichzeitig: Status bedingt umsetzen.
  const { data: claimed, error: claimError } = await supabase
    .from("sources")
    .update({ status: "processing", error: null })
    .eq("id", sourceId)
    .in("status", ["uploaded", "failed"])
    .select("id, storage_path, type");
  if (claimError) throw claimError;

  const source = claimed[0];
  if (!source) {
    const { data: current, error } = await supabase
      .from("sources")
      .select("status, page_count")
      .eq("id", sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new UserFacingError("Quelle wurde nicht gefunden.");
    if (current.status === "ready") {
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("source_id", sourceId);
      return { status: "ready", pageCount: current.page_count, chunkCount: count ?? 0 };
    }
    return { status: "processing", skipped: true };
  }

  try {
    const { pageCount, chunkCount } = await ingest(deps, sourceId, source);
    const { error } = await supabase
      .from("sources")
      .update({ status: "ready", page_count: pageCount, error: null })
      .eq("id", sourceId);
    if (error) throw error;
    return { status: "ready", pageCount, chunkCount };
  } catch (error) {
    const message = describeIngestionError(error);
    // Erwartbare Fehler (Scan, kaputtes PDF, Tageslimit ...) stehen schon als Meldung
    // an der Quelle. Ins Log gehören nur unerwartete Fehler.
    if (message === INGESTION_MESSAGES.generic) {
      console.error(`Verarbeitung von Quelle ${sourceId} fehlgeschlagen`, error);
    }
    await supabase.from("chunks").delete().eq("source_id", sourceId);
    await supabase.from("sources").update({ status: "failed", error: message }).eq("id", sourceId);
    return { status: "failed", error: message };
  }
}

// PDFs: Text seitenweise. Text-Quellen (US-08): ein Block ohne Seitenzahl.
async function readPages(file: Blob, type: string): Promise<{ pages: TextPage[]; pageCount: number | null }> {
  if (type === "text") {
    const text = normalizePageText(await file.text());
    if (!text) throw new EmptyTextError();
    return { pages: [{ pageNumber: null, text }], pageCount: null };
  }

  const pdf = await extractPdfPages(new Uint8Array(await file.arrayBuffer()));
  if (pdf.totalPages > MAX_PDF_PAGES) throw new TooManyPagesError(pdf.totalPages, MAX_PDF_PAGES);
  if (isLikelyScanned(pdf)) throw new ScannedPdfError();
  return { pages: pdf.pages, pageCount: pdf.totalPages };
}

async function ingest(
  { supabase, embed, chunkOptions }: IngestionDeps,
  sourceId: string,
  source: { storage_path: string; type: string },
): Promise<{ pageCount: number | null; chunkCount: number }> {
  const { data: file, error: downloadError } = await supabase.storage
    .from(SOURCES_BUCKET)
    .download(source.storage_path);
  if (downloadError || !file) throw new FileMissingError(downloadError);

  const { pages, pageCount } = await readPages(file, source.type);
  const chunks = chunkPages(pages, chunkOptions);
  if (chunks.length === 0) throw source.type === "text" ? new EmptyTextError() : new ScannedPdfError();

  const embeddings = await embed(chunks.map((chunk) => chunk.content));
  assertEmbeddings(embeddings, chunks.length);

  // Bei erneuter Verarbeitung alte Chunks ersetzen statt verdoppeln.
  const { error: deleteError } = await supabase.from("chunks").delete().eq("source_id", sourceId);
  if (deleteError) throw deleteError;

  for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
    const rows = chunks.slice(i, i + INSERT_BATCH_SIZE).map((chunk, j) => ({
      source_id: sourceId,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: JSON.stringify(embeddings[i + j]),
    }));
    const { error } = await supabase.from("chunks").insert(rows);
    if (error) throw error;
  }

  return { pageCount, chunkCount: chunks.length };
}
