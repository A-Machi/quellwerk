"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/backend/auth";
import { toActionError, type ActionResult } from "@/backend/errors";
import { createNotebook, deleteNotebook, renameNotebook } from "@/backend/notebooks/service";

export async function createNotebookAction(): Promise<ActionResult> {
  let id: string;
  try {
    const { supabase } = await requireSession();
    id = (await createNotebook(supabase)).id;
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/notebooks/${id}`);
}

export async function renameNotebookAction(id: string, title: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await renameNotebook(supabase, id, title);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteNotebookAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await deleteNotebook(supabase, id);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}
