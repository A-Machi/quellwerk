import "server-only";

import { z } from "zod";

import type { Embedder } from "@/backend/ai/embeddings";
import type { ChatLlm } from "@/backend/chat/llm";
import {
  buildCitations,
  buildHistoryMessages,
  buildInstructions,
  buildRewriteInstructions,
  buildRewritePrompt,
  buildUserPrompt,
  cleanRewrittenQuestion,
  HISTORY_LIMIT,
  NO_ANSWER,
  type Citation,
  type HistoryMessage,
  type RetrievedChunk,
} from "@/backend/chat/prompt";
import { UserFacingError } from "@/backend/errors";
import { isQuotaExceededError } from "@/backend/ingestion/errors";
import { getNotebook, parseId } from "@/backend/notebooks/service";
import { extractSearchTerms } from "@/backend/search/keywords";
import type { Json } from "@/backend/supabase/database.types";
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
export async function readySourceIds(
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
  // US-20: Hybrid-Suche aus Vektor-Ähnlichkeit und Volltext (exakte Begriffe wie "LLM05")
  const { data: matches, error } = await supabase.rpc("match_chunks_hybrid", {
    query_embedding: JSON.stringify(vector),
    query_terms: extractSearchTerms(query),
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

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

// US-11: gespeicherter Chatverlauf eines Notebooks, älteste Nachricht zuerst
export async function listMessages(
  supabase: AppSupabaseClient,
  notebookId: string,
  limit = 100,
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, citations, created_at")
    .eq("notebook_id", parseId(notebookId, "Notebook"))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data.reverse().map((row) => ({
    id: row.id,
    role: row.role as StoredMessage["role"],
    content: row.content,
    citations: Array.isArray(row.citations) ? (row.citations as unknown as Citation[]) : [],
    createdAt: row.created_at,
  }));
}

export async function clearMessages(supabase: AppSupabaseClient, notebookId: string): Promise<void> {
  const notebook = await getNotebook(supabase, notebookId);
  if (!notebook) throw new UserFacingError("Notebook wurde nicht gefunden.");
  const { error } = await supabase.from("messages").delete().eq("notebook_id", notebook.id);
  if (error) throw error;
}

async function saveMessage(
  supabase: AppSupabaseClient,
  notebookId: string,
  role: StoredMessage["role"],
  content: string,
  citations: Citation[] = [],
): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ notebook_id: notebookId, role, content, citations: citations as unknown as Json })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Folgefragen mit dem Verlauf eigenständig machen. Schlägt das fehl, wird mit der
// Originalfrage gesucht, statt die ganze Antwort scheitern zu lassen.
export async function rewriteQuestion(
  llm: ChatLlm,
  history: HistoryMessage[],
  question: string,
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const rewritten = await llm.complete({
      instructions: buildRewriteInstructions(),
      messages: [{ role: "user", content: buildRewritePrompt(history, question) }],
    });
    return cleanRewrittenQuestion(rewritten, question);
  } catch (error) {
    if (isQuotaExceededError(error)) throw error;
    console.error("Umformulieren der Folgefrage fehlgeschlagen", error);
    return question;
  }
}

export type PreparedAnswer = {
  citations: Citation[];
  // Frage, mit der tatsächlich gesucht wurde (bei Folgefragen umformuliert)
  searchQuery: string;
  stream: AsyncIterable<string>;
  // Speichert die fertige Antwort im Verlauf und liefert ihre ID.
  finish: (answer: string) => Promise<string>;
};

async function* single(text: string): AsyncIterable<string> {
  yield text;
}

// US-09/US-11: Frage speichern, Folgefrage umformulieren, passende Chunks aus den
// ausgewählten Quellen suchen, mit Verlauf ans Modell geben und die Antwort streamen.
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

  const history = (await listMessages(deps.supabase, notebook.id, HISTORY_LIMIT)).map(
    ({ role, content }) => ({ role, content }),
  );
  await saveMessage(deps.supabase, notebook.id, "user", request.question);

  const searchQuery = await rewriteQuestion(deps.llm, history, request.question);
  const chunks = await retrieveChunks(deps, searchQuery, sourceIds);
  const citations = buildCitations(chunks);
  const finish = (answer: string) => saveMessage(deps.supabase, notebook.id, "assistant", answer, citations);

  if (chunks.length === 0) return { citations, searchQuery, stream: single(NO_ANSWER), finish };

  return {
    citations,
    searchQuery,
    finish,
    stream: deps.llm.stream({
      instructions: buildInstructions(),
      messages: [
        ...buildHistoryMessages(history),
        { role: "user", content: buildUserPrompt(request.question, chunks) },
      ],
    }),
  };
}
