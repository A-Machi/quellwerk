import "server-only";

import type { PdfPage } from "@/backend/ingestion/extract-pdf";

export type Chunk = {
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
};

export type ChunkOptions = {
  // ca. 800 Token bei ~4 Zeichen pro Token
  maxChars?: number;
  // ca. 100 Token Überlappung zum vorherigen Chunk derselben Seite
  overlapChars?: number;
};

const DEFAULT_MAX_CHARS = 3200;
const DEFAULT_OVERLAP_CHARS = 400;

// Grobe Schätzung ohne Tokenizer. Reicht für Limits und Statistik.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Zerlegt Text in Einheiten, die höchstens maxChars lang sind:
// erst Absätze, zu lange Absätze in Sätze, zu lange Sätze in Wörter.
// Nur ein einzelnes Wort über maxChars wird hart geteilt.
function splitIntoUnits(text: string, maxChars: number): { text: string; sep: string }[] {
  const units: { text: string; sep: string }[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      units.push({ text: trimmed, sep: "\n\n" });
      continue;
    }

    const sentences = trimmed.split(/(?<=[.!?…])\s+/);
    sentences.forEach((sentence, i) => {
      const sep = i === 0 ? "\n\n" : " ";
      if (sentence.length <= maxChars) {
        units.push({ text: sentence, sep });
        return;
      }
      sentence.split(/\s+/).forEach((word, j) => {
        const wordSep = j === 0 ? sep : " ";
        for (let k = 0; k < word.length; k += maxChars) {
          units.push({ text: word.slice(k, k + maxChars), sep: k === 0 ? wordSep : "" });
        }
      });
    });
  }

  return units;
}

// Ende des vorherigen Chunks als Überlappung, an einer Wortgrenze beginnend.
function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return "";
  const tail = text.slice(-overlapChars);
  const firstSpace = tail.search(/\s/);
  return firstSpace === -1 ? "" : tail.slice(firstSpace).trim();
}

// Teilt die Seiten in Chunks. Ein Chunk liegt immer auf genau einer Seite,
// damit Zitate eine eindeutige Seitenzahl haben.
export function chunkPages(pages: PdfPage[], options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(maxChars / 2));
  const chunks: Chunk[] = [];

  const push = (content: string, pageNumber: number) => {
    chunks.push({
      chunkIndex: chunks.length,
      pageNumber,
      content,
      tokenCount: estimateTokens(content),
    });
  };

  for (const page of pages) {
    let current = "";
    let hasNewContent = false;

    for (const unit of splitIntoUnits(page.text, maxChars)) {
      const candidate = current ? current + unit.sep + unit.text : unit.text;
      if (candidate.length <= maxChars) {
        current = candidate;
        hasNewContent = true;
        continue;
      }

      if (hasNewContent) push(current, page.pageNumber);
      const tail = overlapTail(current, overlapChars);
      const withOverlap = tail ? `${tail} ${unit.text}` : unit.text;
      current = withOverlap.length <= maxChars ? withOverlap : unit.text;
      hasNewContent = true;
    }

    if (hasNewContent && current) push(current, page.pageNumber);
  }

  return chunks;
}
