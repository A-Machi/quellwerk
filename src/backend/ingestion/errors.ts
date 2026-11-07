import "server-only";

import { InvalidPdfError } from "@/backend/ingestion/extract-pdf";

export class ScannedPdfError extends Error {
  constructor() {
    super("Gescanntes PDF");
    this.name = "ScannedPdfError";
  }
}

export class TooManyPagesError extends Error {
  constructor(
    readonly pages: number,
    readonly maxPages: number,
  ) {
    super(`PDF hat ${pages} Seiten`);
    this.name = "TooManyPagesError";
  }
}

export class FileMissingError extends Error {
  constructor(cause?: unknown) {
    super("Datei nicht im Storage", { cause });
    this.name = "FileMissingError";
  }
}

export class EmptyTextError extends Error {
  constructor() {
    super("Text ist leer");
    this.name = "EmptyTextError";
  }
}

export const INGESTION_MESSAGES = {
  empty: "Der Text ist leer.",
  scanned: "Gescanntes PDF ohne Text, wird noch nicht unterstützt.",
  invalid: "Die Datei ist kein gültiges PDF oder beschädigt.",
  missing: "Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.",
  quota: "Tageslimit von Workers AI erreicht. Bitte morgen erneut versuchen.",
  generic: "Die Verarbeitung ist fehlgeschlagen. Bitte erneut versuchen.",
} as const;

// Cloudflare meldet das aufgebrauchte Free-Tier-Kontingent mit Code 4006
// ("you have used up your daily free allocation of 10,000 neurons").
export function isQuotaExceededError(error: unknown): boolean {
  const text = collectErrorText(error);
  return /\b4006\b|daily free allocation|neurons/i.test(text);
}

function collectErrorText(error: unknown, depth = 0): string {
  if (depth > 4 || error == null) return "";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);
  const e = error as { message?: unknown; responseBody?: unknown; cause?: unknown; lastError?: unknown };
  return [
    typeof e.message === "string" ? e.message : "",
    typeof e.responseBody === "string" ? e.responseBody : "",
    collectErrorText(e.lastError, depth + 1),
    collectErrorText(e.cause, depth + 1),
  ].join(" ");
}

// Übersetzt Fehler der Pipeline in die Meldung, die an der Quelle angezeigt wird.
export function describeIngestionError(error: unknown): string {
  if (error instanceof ScannedPdfError) return INGESTION_MESSAGES.scanned;
  if (error instanceof InvalidPdfError) return INGESTION_MESSAGES.invalid;
  if (error instanceof FileMissingError) return INGESTION_MESSAGES.missing;
  if (error instanceof EmptyTextError) return INGESTION_MESSAGES.empty;
  if (error instanceof TooManyPagesError) {
    return `Das PDF hat ${error.pages} Seiten, erlaubt sind höchstens ${error.maxPages}.`;
  }
  if (isQuotaExceededError(error)) return INGESTION_MESSAGES.quota;
  return INGESTION_MESSAGES.generic;
}
