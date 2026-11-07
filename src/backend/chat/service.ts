import "server-only";

import { z } from "zod";

import type { Embedder } from "@/backend/ai/embeddings";
import type { ChatLlm } from "@/backend/chat/llm";
import {
  buildCitations,
  buildInstructions,
  buildUserPrompt,
  NO_ANSWER,
  type Citation,
  type RetrievedChunk,
} from "@/backend/chat/prompt";
import { UserFacingError } from "@/backend/errors";
import { isQuotaExceededError } from "@/backend/ingestion/errors";
import { getNotebook } from "@/backend/notebooks/service";
import type { AppSupabaseClient } from "@/backend/supabase/types";

export const MAX_QUESTION_LENGTH = 2000;
export const TOP_K = 8;

export type ChatDeps = { supabase: AppSupabaseClient; embed: Embedder; llm: ChatLlm };

const chatRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Bitte gib eine Frage ein.")
    .max(MAX_QUESTION_LENGTH, `Die Frage darf höchstens ${MAX_QUESTION_LENGTH} Zeichen lang sein.`),
  sourceIds: z.array(z.uuid()).min(1, "Wähle mindestens eine Quelle aus.").max(100),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export function parseChatRequest(value: unknown): ChatRequest {
  const result = chatRequestSchema.safeParse(value);
  if (!result.success) {
    throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültige Anfrage.");
  }
  return result.data;
}

export const CHAT_MESSAGES = {
  quota: "Tageslimit von Workers AI erreicht. Bitte morgen erneut versuchen.",
  generic: "Die Antwort konnte nicht erzeugt werden. Bitte versuche es erneut.",
} as const;

export function describeChatError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (isQuotaExceededError(error)) return CHAT_MESSAGES.quota;
  return CHAT_MESSAGES.generic;
}

// Nur fertige Quellen dieses Notebooks durchsuchen, egal was der Browser schickt.
async function readySourceIds(
  supabase: AppSupabaseClient,
  notebookId: string,
  sourceIds: string[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("status", "ready")
    .in("id", sourceIds);
  if (error) throw error;
  return data.map((row) => row.id);
}

export async function retrieveChunks(
  { supabase, embed }: Pick<ChatDeps, "supabase" | "embed">,
  query: string,
  sourceIds: string[],
  limit = TOP_K,
): Promise<RetrievedChunk[]> {
  const [vector] = await embed([query]);
  const { data: matches, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(vector),
    source_ids: sourceIds,
    match_count: limit,
  });
  if (error) throw error;
  if (matches.length === 0) return [];

  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("id, title")
    .in("id", [...new Set(matches.map((m) => m.source_id))]);
  if (sourceError) throw sourceError;
  const titles = new Map(sources.map((s) => [s.id, s.title]));

  return matches.map((m) => ({
    id: m.id,
    sourceId: m.source_id,
    sourceTitle: titles.get(m.source_id) ?? "Quelle",
    pageNumber: m.page_number,
    content: m.content,
    similarity: m.similarity,
  }));
}

export type PreparedAnswer = {
  citations: Citation[];
  stream: AsyncIterable<string>;
};

async function* single(text: string): AsyncIterable<string> {
  yield text;
}

// US-09: Frage einbetten, passende Chunks aus den ausgewählten Quellen suchen,
// nummeriert ans Modell geben und die Antwort streamen.
export async function prepareAnswer(
  deps: ChatDeps,
  notebookId: string,
  input: unknown,
): Promise<PreparedAnswer> {
  const request = parseChatRequest(input);
  const notebook = await getNotebook(deps.supabase, notebookId);
  if (!notebook) throw new UserFacingError("Notebook wurde nicht gefunden.");

  const sourceIds = await readySourceIds(deps.supabase, notebook.id, request.sourceIds);
  if (sourceIds.length === 0) {
    throw new UserFacingError("Keine der ausgewählten Quellen ist fertig verarbeitet.");
  }

  const chunks = await retrieveChunks(deps, request.question, sourceIds);
  if (chunks.length === 0) return { citations: [], stream: single(NO_ANSWER) };

  return {
    citations: buildCitations(chunks),
    stream: deps.llm.stream({
      instructions: buildInstructions(),
      messages: [{ role: "user", content: buildUserPrompt(request.question, chunks) }],
    }),
  };
}
