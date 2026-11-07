import type { NoteKind } from "@/backend/notes/service";
import type { StudioKind } from "@/backend/studio/prompt";

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Notiz",
  faq: "FAQ",
  briefing: "Briefing",
  study_guide: "Study Guide",
  timeline: "Zeitleiste",
};

// US-15: Kacheln im Studio, Reihenfolge wie entschieden (FAQ, Briefing, Study Guide, Zeitleiste)
export const STUDIO_TILES: { kind: StudioKind; label: string; description: string }[] = [
  { kind: "faq", label: "FAQ", description: "Häufige Fragen mit Antworten" },
  { kind: "briefing", label: "Briefing", description: "Kurzfassung für Entscheider" },
  { kind: "study_guide", label: "Study Guide", description: "Begriffe und Lernfragen" },
  { kind: "timeline", label: "Zeitleiste", description: "Ereignisse nach Datum" },
];

// Geschätzter Verbrauch einer Studio-Ausgabe (siehe Kosten-Tabelle in eval/MVP_USER_STORIES.md)
export const STUDIO_NEURON_ESTIMATE = 200;

export function isStudioKind(kind: NoteKind): kind is StudioKind {
  return kind !== "note";
}

// Titel aus einer Frage oder einem Text, höchstens 120 Zeichen
export function deriveTitle(text: string, fallback = "Notiz"): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return fallback;
  return line.length <= 120 ? line : `${line.slice(0, 117).trimEnd()} …`;
}
