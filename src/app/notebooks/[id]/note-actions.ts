"use server";

import { refresh } from "next/cache";

import { requireSession } from "@/backend/auth";
import type { Citation } from "@/backend/chat/prompt";
import { toActionError, type ActionResult } from "@/backend/errors";
import { createNote, deleteNote, noteToSource, updateNote } from "@/backend/notes/service";

// US-17 (Antwort speichern) und US-18 (eigene Notiz)
export async function createNoteAction(
  notebookId: string,
  input: { title: string; content: string; citations?: Citation[] },
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireSession();
    const note = await createNote(supabase, notebookId, { kind: "note", ...input });
    refresh();
    return { ok: true, data: { id: note.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateNoteAction(id: string, input: { title: string; content: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await updateNote(supabase, id, input);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteNoteAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await deleteNote(supabase, id);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

// US-19: Notiz als Quelle. Verarbeitet wird danach über die Process-Route.
export async function noteToSourceAction(id: string): Promise<ActionResult<{ sourceId: string }>> {
  try {
    const { supabase, user } = await requireSession();
    return { ok: true, data: await noteToSource(supabase, user.id, id) };
  } catch (error) {
    return toActionError(error);
  }
}
