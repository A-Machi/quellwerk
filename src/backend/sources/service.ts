import "server-only";

import { z } from "zod";

import { UserFacingError } from "@/backend/errors";
import { parseId } from "@/backend/notebooks/service";
import { removeStorageFile, sourceStoragePath } from "@/backend/storage";
import {
  SOURCES_BUCKET,
  type AppSupabaseClient,
  type SourceStatus,
  type SourceType,
} from "@/backend/supabase/types";

// Limit von Supabase Free pro Datei und vom Bucket "sources"
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_SOURCE_TITLE_LENGTH = 300;

export type SourceSummary = {
  id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  error: string | null;
  pageCount: number | null;
  createdAt: string;
};

export type PdfUploadRequest = { fileName: string; size: number; type: string };

export type PdfUploadTicket = {
  sourceId: string;
  path: string;
  token: string;
};

const sourceTitleSchema = z
  .string()
  .trim()
  .min(1, "Der Titel darf nicht leer sein.")
  .max(MAX_SOURCE_TITLE_LENGTH, `Der Titel darf höchstens ${MAX_SOURCE_TITLE_LENGTH} Zeichen lang sein.`);

export function parseSourceTitle(value: unknown): string {
  const result = sourceTitleSchema.safeParse(value);
  if (!result.success) {
    throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültiger Titel.");
  }
  return result.data;
}

// Prüft eine Datei vor dem Upload und leitet den Titel aus dem Dateinamen ab.
export function validatePdfUpload(request: PdfUploadRequest): { title: string } {
  const fileName = request.fileName.trim();
  const isPdfName = fileName.toLowerCase().endsWith(".pdf");
  // Manche Browser liefern bei PDFs einen leeren MIME-Typ.
  const isPdfType = request.type === "application/pdf" || request.type === "";
  if (!isPdfName || !isPdfType) {
    throw new UserFacingError(`„${fileName}“ ist kein PDF. Es können nur PDF-Dateien hochgeladen werden.`);
  }
  if (!Number.isFinite(request.size) || request.size <= 0) {
    throw new UserFacingError(`„${fileName}“ ist leer.`);
  }
  if (request.size > MAX_UPLOAD_BYTES) {
    throw new UserFacingError(`„${fileName}“ ist größer als 50 MB.`);
  }

  const title = fileName.slice(0, -".pdf".length).trim().slice(0, MAX_SOURCE_TITLE_LENGTH).trim();
  return { title: title || "Unbenannte Quelle" };
}

// Legt die Quelle an und liefert eine signierte Upload-URL.
// Der Browser lädt die Datei direkt in den Storage (nicht durch Vercel, 4,5-MB-Limit).
export async function createPdfUpload(
  supabase: AppSupabaseClient,
  userId: string,
  notebookId: string,
  request: PdfUploadRequest,
): Promise<PdfUploadTicket> {
  const { title } = validatePdfUpload(request);
  const parsedNotebookId = parseId(notebookId, "Notebook");

  const sourceId = crypto.randomUUID();
  const path = sourceStoragePath(userId, parsedNotebookId, sourceId);

  const { error: insertError } = await supabase.from("sources").insert({
    id: sourceId,
    notebook_id: parsedNotebookId,
    type: "pdf",
    title,
    storage_path: path,
  });
  if (insertError) {
    // 42501: RLS hat das Einfügen abgelehnt, das Notebook gehört nicht dem Nutzer.
    if (insertError.code === "42501" || insertError.code === "23503") {
      throw new UserFacingError("Notebook wurde nicht gefunden.");
    }
    throw insertError;
  }

  const { data, error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    await supabase.from("sources").delete().eq("id", sourceId);
    throw error ?? new Error("Keine Upload-URL erhalten");
  }

  return { sourceId, path: data.path, token: data.token };
}

export async function listSources(
  supabase: AppSupabaseClient,
  notebookId: string,
): Promise<SourceSummary[]> {
  const { data, error } = await supabase
    .from("sources")
    .select("id, title, type, status, error, page_count, created_at")
    .eq("notebook_id", parseId(notebookId, "Notebook"))
    .order("created_at", { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type as SourceType,
    status: row.status as SourceStatus,
    error: row.error,
    pageCount: row.page_count,
    createdAt: row.created_at,
  }));
}

export async function renameSource(
  supabase: AppSupabaseClient,
  id: string,
  title: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("sources")
    .update({ title: parseSourceTitle(title) })
    .eq("id", parseId(id, "Quelle"))
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new UserFacingError("Quelle wurde nicht gefunden.");
}

// Löscht die Datei im Storage und die Quelle. Chunks verschwinden per Cascade.
export async function deleteSource(supabase: AppSupabaseClient, id: string): Promise<void> {
  const sourceId = parseId(id, "Quelle");
  const { data: source, error: readError } = await supabase
    .from("sources")
    .select("id, storage_path")
    .eq("id", sourceId)
    .maybeSingle();
  if (readError) throw readError;
  if (!source) throw new UserFacingError("Quelle wurde nicht gefunden.");

  await removeStorageFile(supabase, source.storage_path);

  const { error } = await supabase.from("sources").delete().eq("id", source.id);
  if (error) throw error;
}
