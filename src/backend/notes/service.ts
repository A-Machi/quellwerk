import "server-only";

import { z } from "zod";

import { stripCitationMarkers, type Citation } from "@/backend/chat/prompt";
import { UserFacingError } from "@/backend/errors";
import { getNotebook, parseId } from "@/backend/notebooks/service";
import { createTextSource } from "@/backend/sources/service";
import type { Json } from "@/backend/supabase/database.types";
import type { AppSupabaseClient } from "@/backend/supabase/types";

// Eigene Notizen (US-17, US-18) und Studio-Ausgaben (US-15) liegen in einer Tabelle.
export type NoteKind = "note" | "study_guide" | "faq" | "briefing" | "timeline";

export type StoredNote = {
  id: string;
  kind: NoteKind;
  title: string;
  content: string;
  citations: Citation[];
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export const MAX_NOTE_CHARS = 100_000;

const noteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Bitte gib einen Titel ein.")
    .max(300, "Der Titel darf höchstens 300 Zeichen lang sein."),
  content: z
    .string()
    .trim()
    .min(1, "Die Notiz darf nicht leer sein.")
    .max(MAX_NOTE_CHARS, "Die Notiz ist zu lang."),
});

export function parseNoteInput(value: unknown): { title: string; content: string } {
  const result = noteInputSchema.safeParse(value);
  if (!result.success) throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültige Notiz.");
  return result.data;
}

// Titel aus einer Frage oder einem Text ableiten, z. B. für "Als Notiz speichern"
export function deriveNoteTitle(text: string, fallback = "Notiz"): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return fallback;
  return firstLine.length <= 120 ? firstLine : `${firstLine.slice(0, 117).trimEnd()} …`;
}

type NoteRow = {
  id: string;
  kind: string;
  title: string;
  content: string;
  citations: Json;
  source_ids: string[];
  created_at: string;
  updated_at: string;
};

const NOTE_COLUMNS = "id, kind, title, content, citations, source_ids, created_at, updated_at";

function toNote(row: NoteRow): StoredNote {
  return {
    id: row.id,
    kind: row.kind as NoteKind,
    title: row.title,
    content: row.content,
    citations: Array.isArray(row.citations) ? (row.citations as unknown as Citation[]) : [],
    sourceIds: row.source_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNotes(supabase: AppSupabaseClient, notebookId: string): Promise<StoredNote[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("notebook_id", parseId(notebookId, "Notebook"))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toNote);
}

export async function createNote(
  supabase: AppSupabaseClient,
  notebookId: string,
  input: { kind?: NoteKind; title: string; content: string; citations?: Citation[]; sourceIds?: string[] },
): Promise<StoredNote> {
  const { title, content } = parseNoteInput(input);
  const notebook = await getNotebook(supabase, notebookId);
  if (!notebook) throw new UserFacingError("Notebook wurde nicht gefunden.");

  const { data, error } = await supabase
    .from("notes")
    .insert({
      notebook_id: notebook.id,
      kind: input.kind ?? "note",
      title,
      content,
      citations: (input.citations ?? []) as unknown as Json,
      source_ids: input.sourceIds ?? [],
    })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return toNote(data);
}

// Nur eigene Notizen sind bearbeitbar, Studio-Ausgaben werden neu erzeugt.
export async function updateNote(
  supabase: AppSupabaseClient,
  id: string,
  input: { title: string; content: string },
): Promise<StoredNote> {
  const { title, content } = parseNoteInput(input);
  const { data, error } = await supabase
    .from("notes")
    .update({ title, content })
    .eq("id", parseId(id, "Notiz"))
    .eq("kind", "note")
    .select(NOTE_COLUMNS);
  if (error) throw error;
  if (!data[0]) throw new UserFacingError("Notiz wurde nicht gefunden.");
  return toNote(data[0]);
}

export async function deleteNote(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from("notes").delete().eq("id", parseId(id, "Notiz")).select("id");
  if (error) throw error;
  if (data.length === 0) throw new UserFacingError("Notiz wurde nicht gefunden.");
}

// US-19: Notiz als Text-Quelle hinzufügen. Zitat-Marker gehören nicht in die Quelle.
export async function noteToSource(
  supabase: AppSupabaseClient,
  userId: string,
  id: string,
): Promise<{ sourceId: string }> {
  const { data: note, error } = await supabase
    .from("notes")
    .select("notebook_id, title, content")
    .eq("id", parseId(id, "Notiz"))
    .maybeSingle();
  if (error) throw error;
  if (!note) throw new UserFacingError("Notiz wurde nicht gefunden.");

  return createTextSource(supabase, userId, note.notebook_id, {
    title: note.title.slice(0, 300),
    text: stripCitationMarkers(note.content),
  });
}
