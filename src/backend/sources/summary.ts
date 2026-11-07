import "server-only";

import type { ChatLlm } from "@/backend/chat/llm";
import { UserFacingError } from "@/backend/errors";
import { isQuotaExceededError } from "@/backend/ingestion/errors";
import { parseId } from "@/backend/notebooks/service";
import type { AppSupabaseClient } from "@/backend/supabase/types";

// Höchstens so viele Token gehen in eine Zusammenfassung (ca. 240 Neurons).
export const SUMMARY_MAX_TOKENS = 12_000;
const MAX_TOPICS = 6;
const MAX_TOPIC_LENGTH = 80;

export type SummaryChunk = {
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
};

// Kleine Quellen komplett, große als Auswahl: Anfang (Einleitung), Ende (Fazit)
// und gleichmäßig verteilte Abschnitte dazwischen, bis das Token-Budget voll ist.
export function selectChunksForSummary(chunks: SummaryChunk[], maxTokens = SUMMARY_MAX_TOKENS): SummaryChunk[] {
  const total = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  if (total <= maxTokens) return chunks;

  const picked = new Set<number>();
  let used = 0;
  const tryPick = (index: number) => {
    const chunk = chunks[index];
    if (!chunk || picked.has(index) || used + chunk.tokenCount > maxTokens) return;
    picked.add(index);
    used += chunk.tokenCount;
  };

  tryPick(0);
  tryPick(1);
  tryPick(chunks.length - 1);

  // Abstand halbieren, bis das Budget erschöpft ist: erst grob, dann feiner verteilt.
  for (let step = Math.floor(chunks.length / 2); step >= 1; step = Math.floor(step / 2)) {
    for (let i = step; i < chunks.length - 1; i += step) tryPick(i);
  }

  return chunks.filter((_, index) => picked.has(index));
}

export function buildSummaryInstructions(): string {
  return [
    "Du fasst eine Quelle für den Nutzer von Quellwerk zusammen.",
    "Nutze nur den gegebenen Text. Bei Auszügen aus einem langen Dokument fasse das Dokument als Ganzes zusammen.",
    "Antworte auf Deutsch und genau in diesem Format:",
    "ZUSAMMENFASSUNG:",
    "<4 bis 6 Sätze>",
    "THEMEN:",
    "- <Schlüsselthema 1>",
    "- <Schlüsselthema 2>",
    "Nenne 3 bis 6 Schlüsselthemen, jeweils 1 bis 5 Wörter.",
  ].join("\n");
}

export function buildSummaryPrompt(title: string, chunks: SummaryChunk[], isExcerpt: boolean): string {
  const parts = chunks.map((c) => (c.pageNumber == null ? c.content : `[Seite ${c.pageNumber}]\n${c.content}`));
  return `Quelle: ${title}${isExcerpt ? " (Auszüge)" : ""}\n\n${parts.join("\n\n")}`;
}

export function parseSummaryResponse(text: string): { summary: string; topics: string[] } {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const summaryMatch = normalized.match(/ZUSAMMENFASSUNG:?\s*([\s\S]*?)(?:\n\s*THEMEN:?|$)/i);
  const topicsMatch = normalized.match(/THEMEN:?\s*([\s\S]*)$/i);

  const summary = (summaryMatch?.[1] ?? normalized).replace(/\*\*/g, "").trim();
  const topics = (topicsMatch?.[1] ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter((topic) => topic.length > 0 && topic.length <= MAX_TOPIC_LENGTH);

  return { summary, topics: [...new Set(topics)].slice(0, MAX_TOPICS) };
}

export type SummaryResult =
  | { status: "ready"; summary: string; topics: string[] }
  | { status: "failed"; reason: "quota" | "error" };

// US-14: Zusammenfassung erzeugen und speichern. Nur für fertig verarbeitete Quellen.
export async function summarizeSource(
  { supabase, llm }: { supabase: AppSupabaseClient; llm: ChatLlm },
  id: string,
): Promise<SummaryResult> {
  const sourceId = parseId(id, "Quelle");
  const { data: source, error } = await supabase
    .from("sources")
    .update({ summary_status: "pending" })
    .eq("id", sourceId)
    .eq("status", "ready")
    .select("id, title")
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new UserFacingError("Quelle wurde nicht gefunden oder ist noch nicht verarbeitet.");

  try {
    const { data: rows, error: chunkError } = await supabase
      .from("chunks")
      .select("chunk_index, page_number, content, token_count")
      .eq("source_id", sourceId)
      .order("chunk_index");
    if (chunkError) throw chunkError;

    const chunks = rows.map((r) => ({
      chunkIndex: r.chunk_index,
      pageNumber: r.page_number,
      content: r.content,
      tokenCount: r.token_count,
    }));
    const selected = selectChunksForSummary(chunks);

    const answer = await llm.complete({
      instructions: buildSummaryInstructions(),
      messages: [{ role: "user", content: buildSummaryPrompt(source.title, selected, selected.length < chunks.length) }],
      usageKind: "summary",
      maxOutputTokens: 900,
    });
    const { summary, topics } = parseSummaryResponse(answer);
    if (!summary) throw new Error("Leere Zusammenfassung");

    const { error: saveError } = await supabase
      .from("sources")
      .update({ summary, key_topics: topics, summary_status: "ready" })
      .eq("id", sourceId);
    if (saveError) throw saveError;
    return { status: "ready", summary, topics };
  } catch (failure) {
    const quota = isQuotaExceededError(failure);
    if (!quota) console.error(`Zusammenfassung von Quelle ${sourceId} fehlgeschlagen`, failure);
    await supabase.from("sources").update({ summary_status: "failed" }).eq("id", sourceId);
    return { status: "failed", reason: quota ? "quota" : "error" };
  }
}
