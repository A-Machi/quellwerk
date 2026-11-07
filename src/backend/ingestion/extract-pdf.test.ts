import { makePdf } from "@tests/helpers/pdf";
import { describe, expect, it } from "vitest";

import {
  extractPdfPages,
  InvalidPdfError,
  isLikelyScanned,
  normalizePageText,
} from "@/backend/ingestion/extract-pdf";

describe("normalizePageText", () => {
  it("führt Silbentrennung am Zeilenende zusammen", () => {
    expect(normalizePageText("Die Verarbei-\ntung läuft.")).toBe("Die Verarbeitung läuft.");
  });

  it("lässt Bindestriche vor Großbuchstaben stehen (Nord-\\nSüd)", () => {
    expect(normalizePageText("Nord-\nSüd-Verbindung")).toBe("Nord- Süd-Verbindung");
  });

  it("macht aus einfachen Umbrüchen Leerzeichen und behält Absätze", () => {
    expect(normalizePageText("Zeile eins\nZeile zwei\n\n\nNeuer Absatz")).toBe(
      "Zeile eins Zeile zwei\n\nNeuer Absatz",
    );
  });

  it("entfernt Steuerzeichen und doppelte Leerzeichen", () => {
    expect(normalizePageText("A\u0000B  \t C\r\nD")).toBe("AB C D");
  });
});

describe("extractPdfPages", () => {
  it("liest den Text seitenweise mit Seitenzahlen", async () => {
    const pdf = await makePdf([
      "Der Umsatz stieg 2025 auf 4,2 Mio. Euro.",
      "Die Zahl der Mitarbeitenden wuchs von 38 auf 45.",
    ]);
    const result = await extractPdfPages(pdf);

    expect(result.totalPages).toBe(2);
    expect(result.pages[0]).toEqual({ pageNumber: 1, text: "Der Umsatz stieg 2025 auf 4,2 Mio. Euro." });
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain("von 38 auf 45");
    expect(isLikelyScanned(result)).toBe(false);
  });

  it("erkennt Umlaute korrekt", async () => {
    const result = await extractPdfPages(await makePdf(["Größe, Übersicht, Bäckerei, Straße"]));
    expect(result.pages[0].text).toBe("Größe, Übersicht, Bäckerei, Straße");
  });

  it("erkennt ein PDF ohne Textschicht als gescannt", async () => {
    const result = await extractPdfPages(await makePdf(["", "", ""]));
    expect(result.totalPages).toBe(3);
    expect(isLikelyScanned(result)).toBe(true);
  });

  it("wirft InvalidPdfError bei einer Datei, die kein PDF ist", async () => {
    const notPdf = new TextEncoder().encode("Das ist nur Text, kein PDF.");
    await expect(extractPdfPages(notPdf)).rejects.toBeInstanceOf(InvalidPdfError);
  });
});

describe("isLikelyScanned", () => {
  it("wertet wenige Zeichen pro Seite als Scan", () => {
    expect(isLikelyScanned({ totalPages: 2, pages: [{ pageNumber: 1, text: "S. 1" }, { pageNumber: 2, text: "S. 2" }] })).toBe(true);
    expect(isLikelyScanned({ totalPages: 0, pages: [] })).toBe(true);
    expect(isLikelyScanned({ totalPages: 1, pages: [{ pageNumber: 1, text: "Ein ganz normaler Satz mit Inhalt." }] })).toBe(false);
  });
});
