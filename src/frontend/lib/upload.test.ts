import { describe, expect, it } from "vitest";

import { checkPdfFile, checkTextSource, MAX_TEXT_SOURCE_CHARS, MAX_UPLOAD_BYTES } from "@/frontend/lib/upload";

describe("checkPdfFile", () => {
  it("akzeptiert PDFs bis 50 MB, auch ohne MIME-Typ", () => {
    expect(checkPdfFile({ name: "a.pdf", size: 10, type: "application/pdf" })).toBeNull();
    expect(checkPdfFile({ name: "B.PDF", size: MAX_UPLOAD_BYTES, type: "" })).toBeNull();
  });

  it("lehnt andere Dateien, leere und zu große Dateien mit Dateinamen in der Meldung ab", () => {
    expect(checkPdfFile({ name: "foto.jpg", size: 10, type: "image/jpeg" })).toBe("„foto.jpg“ ist kein PDF.");
    expect(checkPdfFile({ name: "leer.pdf", size: 0, type: "application/pdf" })).toBe("„leer.pdf“ ist leer.");
    expect(checkPdfFile({ name: "gross.pdf", size: MAX_UPLOAD_BYTES + 1, type: "application/pdf" })).toBe(
      "„gross.pdf“ ist größer als 50 MB.",
    );
  });
});

describe("checkTextSource (US-08)", () => {
  it("verlangt Titel und mindestens 20 Zeichen Text", () => {
    expect(checkTextSource({ title: "Notiz", text: "Ein Text mit genug Zeichen." })).toBeNull();
    expect(checkTextSource({ title: "  ", text: "Ein Text mit genug Zeichen." })).toBe("Bitte gib einen Titel ein.");
    expect(checkTextSource({ title: "Notiz", text: "zu kurz" })).toContain("mindestens 20 Zeichen");
    expect(checkTextSource({ title: "Notiz", text: "x".repeat(MAX_TEXT_SOURCE_CHARS + 1) })).toBe("Der Text ist zu lang.");
  });
});
