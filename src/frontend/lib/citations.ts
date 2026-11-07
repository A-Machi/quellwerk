// Zitat-Marker im Antworttext, wie Modelle sie schreiben:
// [1]  [1, 2]  [1][2]  【1】  【1†L3-L5】
// Nicht gemeint sind Markdown-Links [Text](url) und Fußnoten [^1].
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\](?!\()|【(\d+)(?:†[^】]*)?】/g;

export const CITATION_HREF_PREFIX = "#cite-";

// Ersetzt gültige Marker durch Markdown-Links "#cite-n", die der Chat als Chips rendert.
// Nummern, zu denen es keine Quelle gibt, werden entfernt.
export function linkCitations(text: string, valid: ReadonlySet<number>): string {
  return text.replace(MARKER, (_match, list: string | undefined, single: string | undefined) => {
    const numbers = (list ?? single ?? "")
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => valid.has(n));
    return numbers.map((n) => `[${n}](${CITATION_HREF_PREFIX}${n})`).join("");
  });
}

// Welche Quellen-Nummern im Text tatsächlich zitiert werden (in Reihenfolge, ohne Doppelte).
export function citedNumbers(text: string, valid: ReadonlySet<number>): number[] {
  const seen = new Set<number>();
  for (const match of text.matchAll(MARKER)) {
    for (const part of (match[1] ?? match[2] ?? "").split(",")) {
      const n = Number.parseInt(part.trim(), 10);
      if (valid.has(n)) seen.add(n);
    }
  }
  return [...seen];
}

export function citationNumberFromHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;
  const n = Number.parseInt(href.slice(CITATION_HREF_PREFIX.length), 10);
  return Number.isFinite(n) ? n : null;
}
