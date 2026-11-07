import "server-only";

// Feste Antwort, wenn die Quellen die Frage nicht beantworten (US-10).
export const NO_ANSWER = "Dazu steht nichts in den ausgewählten Quellen.";

const EXCERPT_LENGTH = 280;

export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  pageNumber: number | null;
  content: string;
  similarity: number;
};

// Was der Browser zu einem Zitat-Marker [n] anzeigt.
export type Citation = {
  n: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  pageNumber: number | null;
  excerpt: string;
};

export function makeExcerpt(content: string, maxLength = EXCERPT_LENGTH): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk, index) => ({
    n: index + 1,
    chunkId: chunk.id,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    pageNumber: chunk.pageNumber,
    excerpt: makeExcerpt(chunk.content),
  }));
}

export function buildInstructions(): string {
  return [
    "Du bist der Recherche-Assistent von Quellwerk.",
    "Beantworte die Frage ausschließlich anhand der nummerierten Quellen in der Nachricht des Nutzers.",
    "Nutze kein Wissen außerhalb dieser Quellen und erfinde nichts.",
    "Belege jede Aussage direkt dahinter mit der Nummer der Quelle in eckigen Klammern, z. B. [1] oder [2][3].",
    `Wenn die Quellen die Frage nicht beantworten, antworte genau mit: "${NO_ANSWER}"`,
    "Antworte in der Sprache der Frage, klar und präzise. Markdown (Listen, Fettdruck, Tabellen) ist erlaubt.",
  ].join("\n");
}

export type HistoryMessage = { role: "user" | "assistant"; content: string };

// Wie viele frühere Nachrichten das Modell als Kontext bekommt (3 Fragen + 3 Antworten)
export const HISTORY_LIMIT = 6;
const HISTORY_MESSAGE_CHARS = 1500;

// Zitat-Nummern gelten nur für die jeweilige Antwort. Im Verlauf würden sie das Modell
// verwirren, weil [1] in der neuen Antwort eine andere Quelle ist.
export function stripCitationMarkers(text: string): string {
  return text
    .replace(/\s*(?:\[\d+(?:\s*,\s*\d+)*\](?!\()|【[^】]*】)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildHistoryMessages(history: HistoryMessage[]): HistoryMessage[] {
  return history.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.role,
    content: stripCitationMarkers(message.content).slice(0, HISTORY_MESSAGE_CHARS),
  }));
}

// US-11: Folgefragen ("Und was steht zu Punkt 2?") für die Suche eigenständig machen.
export function buildRewriteInstructions(): string {
  return [
    "Formuliere die letzte Frage des Nutzers so um, dass sie ohne den Gesprächsverlauf verständlich ist.",
    "Ersetze Bezüge wie \"er\", \"das\" oder \"Punkt 2\" durch das, worauf sie sich beziehen.",
    "Antworte nur mit der umformulierten Frage, ohne Erklärung.",
    "Ist die Frage schon eigenständig, gib sie unverändert zurück.",
  ].join("\n");
}

export function buildRewritePrompt(history: HistoryMessage[], question: string): string {
  const transcript = buildHistoryMessages(history)
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content.slice(0, 500)}`)
    .join("\n");
  return `Gesprächsverlauf:\n${transcript}\n\nLetzte Frage: ${question}`;
}

// Die Antwort des Modells auf die Umformulierung säubern. Bei leerer oder
// ausufernder Antwort lieber die Originalfrage nehmen.
export function cleanRewrittenQuestion(rewritten: string, original: string): string {
  const text = rewritten
    .trim()
    .replace(/^(umformulierte frage|frage)\s*:\s*/i, "")
    .replace(/^["„“]|["“”]$/g, "")
    .trim();
  if (!text || text.length > 500) return original;
  return text;
}

function sourceLabel(chunk: Pick<RetrievedChunk, "sourceTitle" | "pageNumber">): string {
  return chunk.pageNumber == null ? chunk.sourceTitle : `${chunk.sourceTitle}, Seite ${chunk.pageNumber}`;
}

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  const sources = chunks
    .map((chunk, index) => `[${index + 1}] (${sourceLabel(chunk)})\n${chunk.content}`)
    .join("\n\n");
  return `Quellen:\n\n${sources}\n\nFrage: ${question}`;
}
