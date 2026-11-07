import "server-only";

import { SOURCES_BUCKET, type AppSupabaseClient } from "@/backend/supabase/types";

// Pfade im Bucket: {user_id}/{notebook_id}/{source_id}.pdf bzw. .txt
export function sourceStoragePath(
  userId: string,
  notebookId: string,
  sourceId: string,
  extension: "pdf" | "txt" = "pdf",
): string {
  return `${userId}/${notebookId}/${sourceId}.${extension}`;
}

export async function removeStorageFolder(
  supabase: AppSupabaseClient,
  folder: string,
): Promise<void> {
  const bucket = supabase.storage.from(SOURCES_BUCKET);
  // Seitenweise, weil list() höchstens `limit` Einträge liefert.
  for (;;) {
    const { data, error } = await bucket.list(folder, { limit: 100 });
    if (error) throw error;
    if (data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((file) => `${folder}/${file.name}`));
    if (removeError) throw removeError;
    if (data.length < 100) return;
  }
}

export async function removeStorageFile(supabase: AppSupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from(SOURCES_BUCKET).remove([path]);
  if (error) throw error;
}
