import type { SourceSummary } from "@/backend/sources/service";

// US-07: Gespeichert wird, was der Nutzer abgewählt hat. So sind neu fertig
// verarbeitete Quellen automatisch ausgewählt, wie bei NotebookLM.
export function selectedSourceIds(
  sources: Pick<SourceSummary, "id" | "status">[],
  deselected: ReadonlySet<string>,
): string[] {
  return sources.filter((s) => s.status === "ready" && !deselected.has(s.id)).map((s) => s.id);
}

export type SelectAllState = "all" | "some" | "none";

export function selectAllState(
  sources: Pick<SourceSummary, "id" | "status">[],
  deselected: ReadonlySet<string>,
): SelectAllState {
  const ready = sources.filter((s) => s.status === "ready").length;
  const selected = selectedSourceIds(sources, deselected).length;
  if (ready === 0 || selected === 0) return "none";
  return selected === ready ? "all" : "some";
}

export function parseDeselected(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}
