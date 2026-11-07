import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import { createUsageRecorder } from "@/backend/ai/usage";
import { getSession } from "@/backend/auth";
import { toActionError } from "@/backend/errors";
import { processSource } from "@/backend/ingestion/pipeline";

// Extrahieren, Chunken und Einbetten eines PDFs mit bis zu 300 Seiten
export const maxDuration = 60;

export async function POST(_request: Request, ctx: RouteContext<"/api/sources/[id]/process">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await processSource(
      { supabase: session.supabase, embed: createWorkersAiEmbedder(createUsageRecorder(session.supabase)) },
      id,
    );
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: toActionError(error).error }, { status: 400 });
  }
}
