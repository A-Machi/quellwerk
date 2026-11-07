import "server-only";

import { z } from "zod";

import { UserFacingError } from "@/backend/errors";
import { removeStorageFolder } from "@/backend/storage";
import type { AppSupabaseClient } from "@/backend/supabase/types";

export const DEFAULT_NOTEBOOK_TITLE = "Unbenanntes Notebook";
export const MAX_NOTEBOOK_TITLE_LENGTH = 200;

export type NotebookSummary = {
  id: string;
  title: string;
  updatedAt: string;
  sourceCount: number;
};

export type Notebook = { id: string; title: string };

const notebookTitleSchema = z
  .string()
  .trim()
  .min(1, "Der Titel darf nicht leer sein.")
  .max(MAX_NOTEBOOK_TITLE_LENGTH, `Der Titel darf höchstens ${MAX_NOTEBOOK_TITLE_LENGTH} Zeichen lang sein.`);

const idSchema = z.uuid();

export function parseNotebookTitle(value: unknown): string {
  const result = notebookTitleSchema.safeParse(value);
  if (!result.success) {
    throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültiger Titel.");
  }
  return result.data;
}

export function parseId(value: unknown, label = "Eintrag"): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new UserFacingError(`${label} wurde nicht gefunden.`);
  return result.data;
}

export async function listNotebooks(supabase: AppSupabaseClient): Promise<NotebookSummary[]> {
  const { data, error } = await supabase
    .from("notebooks")
    .select("id, title, updated_at, sources(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    sourceCount: row.sources[0]?.count ?? 0,
  }));
}

export async function getNotebook(
  supabase: AppSupabaseClient,
  id: string,
): Promise<Notebook | null> {
  if (!idSchema.safeParse(id).success) return null;
  const { data, error } = await supabase
    .from("notebooks")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createNotebook(
  supabase: AppSupabaseClient,
  title: string = DEFAULT_NOTEBOOK_TITLE,
): Promise<Notebook> {
  const { data, error } = await supabase
    .from("notebooks")
    .insert({ title: parseNotebookTitle(title) })
    .select("id, title")
    .single();
  if (error) throw error;
  return data;
}

export async function renameNotebook(
  supabase: AppSupabaseClient,
  id: string,
  title: string,
): Promise<Notebook> {
  const { data, error } = await supabase
    .from("notebooks")
    .update({ title: parseNotebookTitle(title) })
    .eq("id", parseId(id, "Notebook"))
    .select("id, title");
  if (error) throw error;
  // RLS liefert bei fremden Notebooks keinen Fehler, sondern 0 Zeilen.
  const row = data[0];
  if (!row) throw new UserFacingError("Notebook wurde nicht gefunden.");
  return row;
}

// Löscht das Notebook samt Quellen, Chunks und Chatverlauf (per Cascade)
// und alle hochgeladenen Dateien im Storage (kein Cascade möglich).
export async function deleteNotebook(supabase: AppSupabaseClient, id: string): Promise<void> {
  const notebookId = parseId(id, "Notebook");
  const { data: notebook, error: readError } = await supabase
    .from("notebooks")
    .select("id, user_id")
    .eq("id", notebookId)
    .maybeSingle();
  if (readError) throw readError;
  if (!notebook) throw new UserFacingError("Notebook wurde nicht gefunden.");

  await removeStorageFolder(supabase, `${notebook.user_id}/${notebook.id}`);

  const { error } = await supabase.from("notebooks").delete().eq("id", notebook.id);
  if (error) throw error;
}
