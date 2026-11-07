import "server-only";

import { assertEmbeddings, type Embedder } from "@/backend/ai/embeddings";
import { UserFacingError } from "@/backend/errors";
import { chunkPages, type ChunkOptions } from "@/backend/ingestion/chunker";
import {
  describeIngestionError,
  FileMissingError,
  ScannedPdfError,
  TooManyPagesError,
} from "@/backend/ingestion/errors";
import { extractPdfPages, isLikelyScanned } from "@/backend/ingestion/extract-pdf";
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
  | { status: "ready"; pageCount: number; chunkCount: number }
  | { status: "failed"; error: string }
  | { status: Exclude<SourceStatus, "ready" | "failed">; skipped: true };

// Verarbeitet eine hochgeladene Quelle: PDF laden, Text seitenweise extrahieren,
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
    .select("id, storage_path");
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
      return { status: "ready", pageCount: current.page_count ?? 0, chunkCount: count ?? 0 };
    }
    return { status: "processing", skipped: true };
  }

  try {
    const { pageCount, chunkCount } = await ingest(deps, sourceId, source.storage_path);
    const { error } = await supabase
      .from("sources")
      .update({ status: "ready", page_count: pageCount, error: null })
      .eq("id", sourceId);
    if (error) throw error;
    return { status: "ready", pageCount, chunkCount };
  } catch (error) {
    if (!(error instanceof ScannedPdfError || error instanceof TooManyPagesError)) {
      console.error(`Verarbeitung von Quelle ${sourceId} fehlgeschlagen`, error);
    }
    const message = describeIngestionError(error);
    await supabase.from("chunks").delete().eq("source_id", sourceId);
    await supabase.from("sources").update({ status: "failed", error: message }).eq("id", sourceId);
    return { status: "failed", error: message };
  }
}

async function ingest(
  { supabase, embed, chunkOptions }: IngestionDeps,
  sourceId: string,
  storagePath: string,
): Promise<{ pageCount: number; chunkCount: number }> {
  const { data: file, error: downloadError } = await supabase.storage
    .from(SOURCES_BUCKET)
    .download(storagePath);
  if (downloadError || !file) throw new FileMissingError(downloadError);

  const pdf = await extractPdfPages(new Uint8Array(await file.arrayBuffer()));
  if (pdf.totalPages > MAX_PDF_PAGES) throw new TooManyPagesError(pdf.totalPages, MAX_PDF_PAGES);
  if (isLikelyScanned(pdf)) throw new ScannedPdfError();

  const chunks = chunkPages(pdf.pages, chunkOptions);
  if (chunks.length === 0) throw new ScannedPdfError();

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

  return { pageCount: pdf.totalPages, chunkCount: chunks.length };
}
