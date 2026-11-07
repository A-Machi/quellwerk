import type { Embedder } from "@/backend/ai/embeddings";
import type { ChatLlm, LlmRequest } from "@/backend/chat/llm";
import { processSource } from "@/backend/ingestion/pipeline";
import { createPdfUpload } from "@/backend/sources/service";
import type { AppSupabaseClient } from "@/backend/supabase/types";
import { makePdf } from "@tests/helpers/pdf";
import { fakeEmbedder } from "@tests/helpers/supabase";

// Lädt ein PDF hoch und verarbeitet es (Standard: Fake-Embeddings ohne Workers AI).
export async function createReadyPdfSource(
  supabase: AppSupabaseClient,
  userId: string,
  notebookId: string,
  pages: string[],
  options: { fileName?: string; embed?: Embedder } = {},
): Promise<string> {
  const pdf = await makePdf(pages);
  const ticket = await createPdfUpload(supabase, userId, notebookId, {
    fileName: options.fileName ?? "quelle.pdf",
    size: pdf.byteLength,
    type: "application/pdf",
  });
  const { error } = await supabase.storage
    .from("sources")
    .uploadToSignedUrl(ticket.path, ticket.token, new Blob([pdf as BlobPart], { type: "application/pdf" }));
  if (error) throw error;
  const result = await processSource({ supabase, embed: options.embed ?? fakeEmbedder }, ticket.sourceId);
  if (result.status !== "ready") throw new Error(`Quelle nicht fertig: ${JSON.stringify(result)}`);
  return ticket.sourceId;
}

// Fake-Sprachmodell: merkt sich die Anfragen und antwortet mit festem Text.
export function fakeLlm(answer = "Antwort [1].", rewrite?: (request: LlmRequest) => string) {
  const streamed: LlmRequest[] = [];
  const completed: LlmRequest[] = [];
  const llm: ChatLlm = {
    async *stream(request) {
      streamed.push(request);
      for (const part of answer.match(/[\s\S]{1,5}/g) ?? []) yield part;
    },
    async complete(request) {
      completed.push(request);
      return rewrite ? rewrite(request) : "umformulierte Frage";
    },
  };
  return { llm, streamed, completed };
}

export async function collectText(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const part of stream) text += part;
  return text;
}
