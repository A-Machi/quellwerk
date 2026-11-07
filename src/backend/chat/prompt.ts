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

function sourceLabel(chunk: Pick<RetrievedChunk, "sourceTitle" | "pageNumber">): string {
  return chunk.pageNumber == null ? chunk.sourceTitle : `${chunk.sourceTitle}, Seite ${chunk.pageNumber}`;
}

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  const sources = chunks
    .map((chunk, index) => `[${index + 1}] (${sourceLabel(chunk)})\n${chunk.content}`)
    .join("\n\n");
  return `Quellen:\n\n${sources}\n\nFrage: ${question}`;
}
