import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import { createUsageRecorder } from "@/backend/ai/usage";
import { getSession } from "@/backend/auth";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { encodeChatEvent, type ChatEvent } from "@/backend/chat/protocol";
import { describeChatError } from "@/backend/chat/service";
import { UserFacingError } from "@/backend/errors";
import { prepareStudio } from "@/backend/studio/service";

export const maxDuration = 60;

// US-15: Studio-Ausgabe erzeugen, streamen (gleiches NDJSON-Format wie der Chat)
// und danach als Notiz speichern. "done" liefert die ID der Notiz.
export async function POST(request: Request, ctx: RouteContext<"/api/notebooks/[id]/studio">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const recordUsage = createUsageRecorder(session.supabase);

  let prepared;
  try {
    prepared = await prepareStudio(
      { supabase: session.supabase, embed: createWorkersAiEmbedder(recordUsage), llm: createWorkersAiLlm(recordUsage) },
      id,
      body,
    );
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("Studio-Anfrage fehlgeschlagen", error);
    return Response.json({ error: describeChatError(error) }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(encodeChatEvent(event)));
      send({ type: "citations", citations: prepared.citations });
      let content = "";
      try {
        for await (const delta of prepared.stream) {
          content += delta;
          send({ type: "text", delta });
        }
        send({ type: "done", messageId: await prepared.finish(content) });
      } catch (error) {
        console.error("Studio-Stream abgebrochen", error);
        send({ type: "error", message: describeChatError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
