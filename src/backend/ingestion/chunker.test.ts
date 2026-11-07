import { describe, expect, it } from "vitest";

import { chunkPages, estimateTokens } from "@/backend/ingestion/chunker";

const sentence = (n: number) => `Satz Nummer ${n} beschreibt die Bäckerei Sonnenkorn ausführlich.`;
const longText = (count: number) => Array.from({ length: count }, (_, i) => sentence(i + 1)).join(" ");
const words = (text: string) => text.split(/\s+/).filter(Boolean);

describe("chunkPages", () => {
  it("liefert keine Chunks für leere Seiten", () => {
    expect(chunkPages([{ pageNumber: 1, text: "" }, { pageNumber: 2, text: "   " }])).toEqual([]);
  });

  it("macht aus einer kurzen Seite genau einen Chunk mit Seitenzahl und Token-Schätzung", () => {
    const text = "Der Umsatz stieg 2025 auf 4,2 Mio. Euro.";
    const chunks = chunkPages([{ pageNumber: 3, text }]);

    expect(chunks).toEqual([
      { chunkIndex: 0, pageNumber: 3, content: text, tokenCount: estimateTokens(text) },
    ]);
  });

  it("hält kurze Absätze einer Seite zusammen und trennt sie mit einer Leerzeile", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "Erster Absatz.\n\nZweiter Absatz." }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Erster Absatz.\n\nZweiter Absatz.");
  });

  it("überschreitet nie die maximale Länge und verliert keinen Text", () => {
    const text = longText(40);
    const chunks = chunkPages([{ pageNumber: 1, text }], { maxChars: 300, overlapChars: 60 });

    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(300);
    for (let i = 1; i <= 40; i++) {
      expect(chunks.some((chunk) => chunk.content.includes(sentence(i)))).toBe(true);
    }
  });

  it("schneidet nie mitten im Wort", () => {
    const text = longText(30);
    const original = new Set(words(text));
    const chunks = chunkPages([{ pageNumber: 1, text }], { maxChars: 250, overlapChars: 70 });

    for (const chunk of chunks) {
      for (const word of words(chunk.content)) expect(original).toContain(word);
    }
  });

  it("überlappt aufeinanderfolgende Chunks derselben Seite", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: longText(20) }], { maxChars: 300, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const start = words(chunks[i].content).slice(0, 3).join(" ");
      expect(chunks[i - 1].content).toContain(start);
    }
  });

  it("lässt keinen Chunk über eine Seitengrenze laufen und nummeriert durchgehend", () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: longText(10) },
        { pageNumber: 2, text: "Seite zwei beginnt hier." },
        { pageNumber: 3, text: "" },
        { pageNumber: 4, text: "Letzte Seite." },
      ],
      { maxChars: 300, overlapChars: 80 },
    );

    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    const page2 = chunks.filter((c) => c.pageNumber === 2);
    expect(page2).toHaveLength(1);
    // Keine Überlappung aus Seite 1 in Seite 2
    expect(page2[0].content).toBe("Seite zwei beginnt hier.");
    expect(chunks.some((c) => c.pageNumber === 3)).toBe(false);
    expect(chunks.at(-1)).toMatchObject({ pageNumber: 4, content: "Letzte Seite." });
  });

  it("teilt ein einzelnes überlanges Wort hart, damit kein Chunk zu lang wird", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "x".repeat(650) }], { maxChars: 200, overlapChars: 0 });

    expect(chunks.map((c) => c.content.length)).toEqual([200, 200, 200, 50]);
    expect(chunks.map((c) => c.content).join("")).toBe("x".repeat(650));
  });
});

describe("estimateTokens", () => {
  it("schätzt etwa 4 Zeichen pro Token und rundet auf", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
