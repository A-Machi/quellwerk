"use server";

import { refresh } from "next/cache";

import { requireSession } from "@/backend/auth";
import { toActionError, type ActionResult } from "@/backend/errors";
import {
  createPdfUpload,
  deleteSource,
  renameSource,
  type PdfUploadRequest,
  type PdfUploadTicket,
} from "@/backend/sources/service";

export async function createUploadAction(
  notebookId: string,
  file: PdfUploadRequest,
): Promise<ActionResult<PdfUploadTicket>> {
  try {
    const { supabase, user } = await requireSession();
    const ticket = await createPdfUpload(supabase, user.id, notebookId, file);
    return { ok: true, data: ticket };
  } catch (error) {
    return toActionError(error);
  }
}

export async function renameSourceAction(id: string, title: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await renameSource(supabase, id, title);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteSourceAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await deleteSource(supabase, id);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, data: undefined };
}
