import { describe, expect, it } from "vitest";

import {
  buildCitations,
  buildInstructions,
  buildUserPrompt,
  makeExcerpt,
  NO_ANSWER,
  type RetrievedChunk,
} from "@/backend/chat/prompt";

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: "chunk-1",
  sourceId: "source-1",
  sourceTitle: "Jahresbericht",
  pageNumber: 2,
  content: "Der Umsatz stieg auf 4,2 Mio. Euro.",
  similarity: 0.8,
  ...overrides,
});

describe("buildCitations", () => {
  it("nummeriert die Chunks ab 1 in Reihenfolge der Suche", () => {
    const citations = buildCitations([chunk(), chunk({ id: "chunk-2", pageNumber: 5, sourceTitle: "Protokoll" })]);
    expect(citations).toEqual([
      { n: 1, chunkId: "chunk-1", sourceId: "source-1", sourceTitle: "Jahresbericht", pageNumber: 2, excerpt: "Der Umsatz stieg auf 4,2 Mio. Euro." },
      { n: 2, chunkId: "chunk-2", sourceId: "source-1", sourceTitle: "Protokoll", pageNumber: 5, excerpt: "Der Umsatz stieg auf 4,2 Mio. Euro." },
    ]);
  });
});

describe("makeExcerpt", () => {
  it("lässt kurze Texte unverändert und fasst Leerraum zusammen", () => {
    expect(makeExcerpt("  Kurzer\n\nText  ")).toBe("Kurzer Text");
  });

  it("kürzt lange Texte an einer Wortgrenze mit Auslassungszeichen", () => {
    const excerpt = makeExcerpt("Wort ".repeat(100), 50);
    expect(excerpt.length).toBeLessThanOrEqual(52);
    expect(excerpt.endsWith(" …")).toBe(true);
    expect(excerpt).not.toMatch(/Wor …$/);
  });
});

describe("buildUserPrompt", () => {
  it("enthält nummerierte Quellen mit Titel und Seite sowie die Frage", () => {
    const prompt = buildUserPrompt("Wie hoch war der Umsatz?", [
      chunk(),
      chunk({ sourceTitle: "Notiz", pageNumber: null, content: "Text ohne Seiten." }),
    ]);
    expect(prompt).toContain("[1] (Jahresbericht, Seite 2)\nDer Umsatz stieg auf 4,2 Mio. Euro.");
    expect(prompt).toContain("[2] (Notiz)\nText ohne Seiten.");
    expect(prompt.trim().endsWith("Frage: Wie hoch war der Umsatz?")).toBe(true);
  });
});

describe("buildInstructions", () => {
  it("verlangt Belege und nennt die feste Antwort für fehlende Informationen", () => {
    const instructions = buildInstructions();
    expect(instructions).toContain("ausschließlich anhand der nummerierten Quellen");
    expect(instructions).toContain("[1]");
    expect(instructions).toContain(NO_ANSWER);
  });
});
