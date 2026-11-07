import "server-only";

import type { RetrievedChunk } from "@/backend/chat/prompt";

export type StudioKind = "faq" | "briefing" | "study_guide" | "timeline";

type StudioType = {
  label: string;
  // Suchanfrage, mit der die passenden Abschnitte gefunden werden
  searchQuery: string;
  task: string;
};

// US-15: die vier Studio-Ausgaben. Reihenfolge = Reihenfolge der Kacheln.
export const STUDIO_TYPES: Record<StudioKind, StudioType> = {
  faq: {
    label: "FAQ",
    searchQuery: "wichtigste Fragen Antworten Überblick Definition Ziel",
    task:
      "Erstelle ein FAQ mit 6 bis 10 Fragen, die sich ein Leser zu diesen Quellen stellen würde. " +
      "Format: jede Frage als fett gesetzte Zeile (**Frage?**), darunter eine knappe Antwort mit Belegen.",
  },
  briefing: {
    label: "Briefing",
    searchQuery: "Ergebnisse Kernaussagen Empfehlungen Risiken Fazit",
    task:
      "Erstelle ein Briefing-Dokument für eine Führungskraft: zuerst eine Kurzfassung in 2 bis 3 Sätzen, " +
      "dann die wichtigsten Punkte als Liste, dann offene Fragen oder Risiken.",
  },
  study_guide: {
    label: "Study Guide",
    searchQuery: "Begriffe Definition Konzept Beispiel Erklärung",
    task:
      "Erstelle einen Study Guide: die wichtigsten Begriffe mit kurzer Erklärung, eine Zusammenfassung der Kernkonzepte " +
      "und am Ende 5 Verständnisfragen mit Lösungen.",
  },
  timeline: {
    label: "Zeitleiste",
    searchQuery: "Datum Jahr Monat Zeitpunkt Ereignis Entwicklung Version",
    task:
      "Erstelle eine chronologische Zeitleiste der datierten Ereignisse als Liste im Format **Datum** – Ereignis. " +
      'Nutze nur Ereignisse mit Datum aus den Quellen. Gibt es keine, antworte genau: "Keine datierten Ereignisse gefunden."',
  },
};

export const STUDIO_KINDS = Object.keys(STUDIO_TYPES) as StudioKind[];

export type SourceOverview = { title: string; summary: string | null; keyTopics: string[] };

export function buildStudioInstructions(kind: StudioKind): string {
  return [
    "Du erstellst eine Ausgabe für das Studio von Quellwerk.",
    STUDIO_TYPES[kind].task,
    "Nutze ausschließlich die Zusammenfassungen und die nummerierten Abschnitte aus der Nachricht des Nutzers. Erfinde nichts.",
    "Belege Aussagen aus den Abschnitten mit der Nummer in eckigen Klammern, z. B. [1] oder [2][3]. Die Zusammenfassungen haben keine Nummer.",
    "Schreibe auf Deutsch in Markdown. Beginne direkt mit dem Inhalt, ohne Einleitung über dich selbst.",
  ].join("\n");
}

export function buildStudioPrompt(overviews: SourceOverview[], chunks: RetrievedChunk[]): string {
  const summaries = overviews
    .map((o) => {
      const topics = o.keyTopics.length > 0 ? ` (Themen: ${o.keyTopics.join(", ")})` : "";
      return `- ${o.title}${topics}: ${o.summary ?? "keine Zusammenfassung vorhanden"}`;
    })
    .join("\n");
  const sections = chunks
    .map((c, i) => {
      const label = c.pageNumber == null ? c.sourceTitle : `${c.sourceTitle}, Seite ${c.pageNumber}`;
      return `[${i + 1}] (${label})\n${c.content}`;
    })
    .join("\n\n");
  return `Zusammenfassungen der Quellen:\n${summaries}\n\nNummerierte Abschnitte:\n\n${sections}`;
}

// Suchanfrage für die Abschnitte: Aufgabe plus Schlüsselthemen der Quellen
export function studioSearchQuery(kind: StudioKind, overviews: SourceOverview[]): string {
  const topics = overviews.flatMap((o) => o.keyTopics).slice(0, 8);
  return [STUDIO_TYPES[kind].searchQuery, ...topics].join(" ");
}

export function studioTitle(kind: StudioKind, sourceTitles: string[]): string {
  const label = STUDIO_TYPES[kind].label;
  if (sourceTitles.length === 0) return label;
  const joined = sourceTitles.length <= 2 ? sourceTitles.join(", ") : `${sourceTitles[0]} und ${sourceTitles.length - 1} weitere`;
  const title = `${label}: ${joined}`;
  return title.length <= 300 ? title : `${title.slice(0, 297)}…`;
}
