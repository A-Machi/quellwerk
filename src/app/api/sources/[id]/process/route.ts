import { after } from "next/server";

import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import { createUsageRecorder } from "@/backend/ai/usage";
import { getSession } from "@/backend/auth";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { toActionError } from "@/backend/errors";
import { processSource } from "@/backend/ingestion/pipeline";
import { summarizeSource } from "@/backend/sources/summary";

// Extrahieren, Chunken und Einbetten eines PDFs mit bis zu 300 Seiten,
// danach die Zusammenfassung (läuft nach der Antwort weiter).
export const maxDuration = 60;

export async function POST(_request: Request, ctx: RouteContext<"/api/sources/[id]/process">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await ctx.params;
  const recordUsage = createUsageRecorder(session.supabase);
  try {
    const result = await processSource(
      { supabase: session.supabase, embed: createWorkersAiEmbedder(recordUsage) },
      id,
    );
    // US-14: Zusammenfassung automatisch erzeugen, ohne die Antwort aufzuhalten
    if (result.status === "ready" && !("skipped" in result)) {
      after(() =>
        summarizeSource({ supabase: session.supabase, llm: createWorkersAiLlm(recordUsage) }, id).catch((error) =>
          console.error("Zusammenfassung nach Verarbeitung fehlgeschlagen", error),
        ),
      );
    }
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: toActionError(error).error }, { status: 400 });
  }
}
