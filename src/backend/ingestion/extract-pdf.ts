import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

export type PdfPage = { pageNumber: number; text: string };

export type ExtractedPdf = { totalPages: number; pages: PdfPage[] };

// Unter diesem Durchschnitt an Zeichen pro Seite gilt ein PDF als gescannt
// (Bilder ohne Textschicht).
export const MIN_CHARS_PER_PAGE = 20;

export class InvalidPdfError extends Error {
  constructor(cause?: unknown) {
    super("Die Datei ist kein gültiges PDF.", { cause });
    this.name = "InvalidPdfError";
  }
}

const CONTROL_CHARS = /[\u0000-\u0008\u000e-\u001f\u007f]/g;
const SPACE_LIKE = /[\t\f\v\u00a0]/g;

// Bereinigt den Rohtext einer Seite:
// - Steuerzeichen entfernen (Postgres lehnt \u0000 in Text ab)
// - Silbentrennung am Zeilenende zusammenführen ("Verarbei-\ntung" -> "Verarbeitung")
// - einfache Zeilenumbrüche werden zu Leerzeichen, Leerzeilen trennen Absätze
// - mehrfache Leerzeichen zusammenfassen
export function normalizePageText(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(SPACE_LIKE, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export async function extractPdfPages(data: Uint8Array): Promise<ExtractedPdf> {
  let result: { totalPages: number; text: string[] };
  try {
    const pdf = await getDocumentProxy(data);
    result = await extractText(pdf, { mergePages: false });
  } catch (error) {
    throw new InvalidPdfError(error);
  }

  return {
    totalPages: result.totalPages,
    pages: result.text.map((text, index) => ({
      pageNumber: index + 1,
      text: normalizePageText(text),
    })),
  };
}

export function isLikelyScanned(pdf: ExtractedPdf): boolean {
  if (pdf.totalPages === 0) return true;
  const chars = pdf.pages.reduce((sum, page) => sum + page.text.replace(/\s/g, "").length, 0);
  return chars / pdf.totalPages < MIN_CHARS_PER_PAGE;
}
