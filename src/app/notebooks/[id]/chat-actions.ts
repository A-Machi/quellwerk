"use server";

import { requireSession } from "@/backend/auth";
import { clearMessages } from "@/backend/chat/service";
import { toActionError, type ActionResult } from "@/backend/errors";
import { getSourcePassage, type SourcePassage } from "@/backend/sources/service";

// US-11: "Chat leeren"
export async function clearChatAction(notebookId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await clearMessages(supabase, notebookId);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

// US-13: zitierte Stelle mit Link auf die Datei laden
export async function getSourcePassageAction(chunkId: string): Promise<ActionResult<SourcePassage>> {
  try {
    const { supabase } = await requireSession();
    return { ok: true, data: await getSourcePassage(supabase, chunkId) };
  } catch (error) {
    return toActionError(error);
  }
}
