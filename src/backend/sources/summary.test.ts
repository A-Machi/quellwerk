import { describe, expect, it } from "vitest";

import {
  buildSummaryInstructions,
  buildSummaryPrompt,
  parseSummaryResponse,
  selectChunksForSummary,
  type SummaryChunk,
} from "@/backend/sources/summary";

const chunks = (count: number, tokenCount = 500): SummaryChunk[] =>
  Array.from({ length: count }, (_, i) => ({ chunkIndex: i, pageNumber: i + 1, content: `Abschnitt ${i}`, tokenCount }));

describe("selectChunksForSummary (US-14)", () => {
  it("nimmt kleine Quellen komplett", () => {
    expect(selectChunksForSummary(chunks(10), 12_000)).toHaveLength(10);
  });

  it("bleibt bei großen Quellen im Token-Budget und nimmt Anfang und Ende mit", () => {
    const all = chunks(127, 450); // wie das OWASP-PDF: ca. 57.000 Token
    const selected = selectChunksForSummary(all, 12_000);
    const tokens = selected.reduce((sum, c) => sum + c.tokenCount, 0);

    expect(tokens).toBeLessThanOrEqual(12_000);
    expect(tokens).toBeGreaterThan(11_000);
    expect(selected[0].chunkIndex).toBe(0);
    expect(selected[1].chunkIndex).toBe(1);
    expect(selected.at(-1)!.chunkIndex).toBe(126);
  });

  it("verteilt die Auswahl über das ganze Dokument und behält die Reihenfolge", () => {
    const selected = selectChunksForSummary(chunks(200, 500), 12_000);
    const indexes = selected.map((c) => c.chunkIndex);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    // in jedem Viertel des Dokuments liegen ausgewählte Abschnitte
    for (const [from, to] of [[0, 50], [50, 100], [100, 150], [150, 200]]) {
      expect(indexes.some((i) => i >= from && i < to)).toBe(true);
    }
  });
});

describe("parseSummaryResponse", () => {
  it("liest Zusammenfassung und Themen aus dem vorgegebenen Format", () => {
    const text = "ZUSAMMENFASSUNG:\nDas Dokument beschreibt Risiken.\nEs nennt zehn Kategorien.\n\nTHEMEN:\n- Prompt Injection\n- **Datenabfluss**\n* Lieferkette\n1. Prompt Injection";
    expect(parseSummaryResponse(text)).toEqual({
      summary: "Das Dokument beschreibt Risiken.\nEs nennt zehn Kategorien.",
      topics: ["Prompt Injection", "Datenabfluss", "Lieferkette"],
    });
  });

  it("nimmt den ganzen Text als Zusammenfassung, wenn das Format fehlt", () => {
    expect(parseSummaryResponse("Nur ein freier Text.")).toEqual({ summary: "Nur ein freier Text.", topics: [] });
  });

  it("begrenzt auf 6 Themen und verwirft überlange", () => {
    const topics = Array.from({ length: 9 }, (_, i) => `- Thema ${i}`).join("\n");
    const result = parseSummaryResponse(`ZUSAMMENFASSUNG:\nText.\nTHEMEN:\n${topics}\n- ${"x".repeat(100)}`);
    expect(result.topics).toHaveLength(6);
  });
});

describe("Prompt für die Zusammenfassung", () => {
  it("nennt Titel, Seiten und ob es Auszüge sind", () => {
    const prompt = buildSummaryPrompt("OWASP", [chunks(1)[0], { ...chunks(1)[0], pageNumber: null, content: "Ohne Seite" }], true);
    expect(prompt).toBe("Quelle: OWASP (Auszüge)\n\n[Seite 1]\nAbschnitt 0\n\nOhne Seite");
    expect(buildSummaryInstructions()).toContain("ZUSAMMENFASSUNG:");
    expect(buildSummaryInstructions()).toContain("Deutsch");
  });
});
