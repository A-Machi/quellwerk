import "server-only";

import { z } from "zod";

import { buildCitations, NO_ANSWER, type Citation } from "@/backend/chat/prompt";
import { readySourceIds, retrieveChunks, type ChatDeps } from "@/backend/chat/service";
import { UserFacingError } from "@/backend/errors";
import { createNote } from "@/backend/notes/service";
import { getNotebook } from "@/backend/notebooks/service";
import {
  buildStudioInstructions,
  buildStudioPrompt,
  STUDIO_KINDS,
  studioSearchQuery,
  studioTitle,
  type SourceOverview,
  type StudioKind,
} from "@/backend/studio/prompt";

// Abschnitte pro Studio-Ausgabe: mit den Zusammenfassungen ca. 9.000 Token Input
const STUDIO_CHUNKS = 8;

const studioRequestSchema = z.object({
  kind: z.enum(STUDIO_KINDS as [StudioKind, ...StudioKind[]], { message: "Unbekannte Studio-Ausgabe." }),
  sourceIds: z.array(z.uuid()).min(1, "Wähle mindestens eine Quelle aus.").max(100),
});

export function parseStudioRequest(value: unknown): { kind: StudioKind; sourceIds: string[] } {
  const result = studioRequestSchema.safeParse(value);
  if (!result.success) throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültige Anfrage.");
  return result.data;
}

export type PreparedStudio = {
  kind: StudioKind;
  title: string;
  citations: Citation[];
  stream: AsyncIterable<string>;
  // Speichert die fertige Ausgabe als Notiz und liefert ihre ID.
  finish: (content: string) => Promise<string>;
};

async function* single(text: string): AsyncIterable<string> {
  yield text;
}

// US-15: Studio-Ausgabe aus den Zusammenfassungen und passenden Abschnitten der
// ausgewählten Quellen erzeugen.
export async function prepareStudio(deps: ChatDeps, notebookId: string, input: unknown): Promise<PreparedStudio> {
  const { kind, sourceIds: requested } = parseStudioRequest(input);
  const notebook = await getNotebook(deps.supabase, notebookId);
  if (!notebook) throw new UserFacingError("Notebook wurde nicht gefunden.");

  const sourceIds = await readySourceIds(deps.supabase, notebook.id, requested);
  if (sourceIds.length === 0) throw new UserFacingError("Keine der ausgewählten Quellen ist fertig verarbeitet.");

  const { data: sources, error } = await deps.supabase
    .from("sources")
    .select("id, title, summary, key_topics")
    .in("id", sourceIds)
    .order("created_at");
  if (error) throw error;
  const overviews: SourceOverview[] = sources.map((s) => ({ title: s.title, summary: s.summary, keyTopics: s.key_topics }));

  const chunks = await retrieveChunks(deps, studioSearchQuery(kind, overviews), sourceIds, STUDIO_CHUNKS);
  const citations = buildCitations(chunks);
  const title = studioTitle(kind, overviews.map((o) => o.title));
  const finish = async (content: string) =>
    (await createNote(deps.supabase, notebook.id, { kind, title, content, citations, sourceIds })).id;

  if (chunks.length === 0) return { kind, title, citations, stream: single(NO_ANSWER), finish };

  return {
    kind,
    title,
    citations,
    finish,
    stream: deps.llm.stream({
      instructions: buildStudioInstructions(kind),
      messages: [{ role: "user", content: buildStudioPrompt(overviews, chunks) }],
      usageKind: "studio",
      maxOutputTokens: 2500,
    }),
  };
}
