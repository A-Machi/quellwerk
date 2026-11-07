import { createWorkersAiEmbedder } from "@/backend/ai/embeddings";
import { getSession } from "@/backend/auth";
import { createWorkersAiLlm } from "@/backend/chat/llm";
import { encodeChatEvent, type ChatEvent } from "@/backend/chat/protocol";
import { describeChatError, prepareAnswer } from "@/backend/chat/service";
import { UserFacingError } from "@/backend/errors";

export const maxDuration = 60;

// US-09: Frage beantworten und die Antwort als NDJSON-Stream senden.
// US-11: Frage und fertige Antwort landen im Chatverlauf des Notebooks.
export async function POST(request: Request, ctx: RouteContext<"/api/notebooks/[id]/chat">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);

  let prepared;
  try {
    prepared = await prepareAnswer(
      { supabase: session.supabase, embed: createWorkersAiEmbedder(), llm: createWorkersAiLlm() },
      id,
      body,
    );
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("Chat-Anfrage fehlgeschlagen", error);
    return Response.json({ error: describeChatError(error) }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(encodeChatEvent(event)));
      send({ type: "citations", citations: prepared.citations });
      let answer = "";
      try {
        for await (const delta of prepared.stream) {
          answer += delta;
          send({ type: "text", delta });
        }
        // US-11: Antwort im Verlauf speichern
        const messageId = await prepared.finish(answer);
        send({ type: "done", messageId });
      } catch (error) {
        console.error("Antwort-Stream abgebrochen", error);
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
