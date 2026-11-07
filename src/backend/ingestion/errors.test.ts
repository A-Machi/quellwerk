import { describe, expect, it } from "vitest";

import {
  describeIngestionError,
  EmptyTextError,
  FileMissingError,
  INGESTION_MESSAGES,
  isQuotaExceededError,
  ScannedPdfError,
  TooManyPagesError,
} from "@/backend/ingestion/errors";
import { InvalidPdfError } from "@/backend/ingestion/extract-pdf";

// So sieht ein Fehler des AI SDK aus, wenn Cloudflare das Tageslimit meldet
// (RetryError mit lastError = APICallError und responseBody).
const quotaError = Object.assign(new Error("Failed after 3 attempts. Last error: Bad Request"), {
  lastError: Object.assign(new Error("Bad Request"), {
    responseBody: JSON.stringify({
      errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }],
    }),
  }),
});

describe("isQuotaExceededError", () => {
  it("erkennt das Tageslimit auch verschachtelt im AI-SDK-Fehler", () => {
    expect(isQuotaExceededError(quotaError)).toBe(true);
    expect(isQuotaExceededError(new Error("AiError: 4006: daily free allocation"))).toBe(true);
  });

  it("schlägt bei anderen Fehlern nicht an", () => {
    expect(isQuotaExceededError(new Error("fetch failed"))).toBe(false);
    expect(isQuotaExceededError(new Error("Status 40061 im Log"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});

describe("describeIngestionError", () => {
  it("liefert für jeden bekannten Fehler die passende Meldung", () => {
    expect(describeIngestionError(new ScannedPdfError())).toBe(INGESTION_MESSAGES.scanned);
    expect(describeIngestionError(new InvalidPdfError())).toBe(INGESTION_MESSAGES.invalid);
    expect(describeIngestionError(new FileMissingError())).toBe(INGESTION_MESSAGES.missing);
    expect(describeIngestionError(new EmptyTextError())).toBe(INGESTION_MESSAGES.empty);
    expect(describeIngestionError(quotaError)).toBe(INGESTION_MESSAGES.quota);
    expect(describeIngestionError(new TooManyPagesError(412, 300))).toBe(
      "Das PDF hat 412 Seiten, erlaubt sind höchstens 300.",
    );
  });

  it("verrät bei unbekannten Fehlern keine technischen Details", () => {
    expect(describeIngestionError(new Error("duplicate key value violates unique constraint"))).toBe(
      INGESTION_MESSAGES.generic,
    );
  });
});
