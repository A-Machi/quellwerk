import { createUsageRecorder } from "@/backend/ai/usage";
import { getSession } from "@/backend/auth";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { toActionError } from "@/backend/errors";
import { summarizeSource } from "@/backend/sources/summary";

export const maxDuration = 60;

// US-14: Zusammenfassung (neu) erzeugen
export async function POST(_request: Request, ctx: RouteContext<"/api/sources/[id]/summary">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await summarizeSource(
      { supabase: session.supabase, llm: createWorkersAiLlm(createUsageRecorder(session.supabase)) },
      id,
    );
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: toActionError(error).error }, { status: 400 });
  }
}
