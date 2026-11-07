import { describe, expect, it } from "vitest";

import {
  getSourceStatusView,
  isStaleUpload,
  shouldPollSources,
  STALE_UPLOAD_MS,
} from "@/frontend/lib/source-status";

const NOW = new Date("2026-11-07T12:00:00Z").getTime();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const base = { error: null, pageCount: null, createdAt: at(1000) };

describe("getSourceStatusView", () => {
  it("zeigt Upload und Verarbeitung als laufend an", () => {
    expect(getSourceStatusView({ ...base, status: "uploaded" }, NOW)).toMatchObject({
      label: "Wird hochgeladen …",
      tone: "busy",
      canRetry: false,
    });
    expect(getSourceStatusView({ ...base, status: "processing" }, NOW)).toMatchObject({
      label: "Wird verarbeitet …",
      tone: "busy",
    });
  });

  it("zeigt bei fertigen Quellen die Seitenzahl in Einzahl oder Mehrzahl", () => {
    expect(getSourceStatusView({ ...base, status: "ready", pageCount: 1 }, NOW).label).toBe("1 Seite");
    expect(getSourceStatusView({ ...base, status: "ready", pageCount: 12 }, NOW).label).toBe("12 Seiten");
  });

  it("zeigt bei Fehlern den Grund und erlaubt einen neuen Versuch", () => {
    const view = getSourceStatusView({ ...base, status: "failed", error: "Gescanntes PDF ohne Text" }, NOW);
    expect(view).toEqual({ label: "Gescanntes PDF ohne Text", tone: "error", busy: false, canRetry: true });
  });

  it("markiert hängengebliebene Uploads als unterbrochen", () => {
    const stale = { ...base, status: "uploaded" as const, createdAt: at(STALE_UPLOAD_MS + 1) };
    expect(isStaleUpload(stale, NOW)).toBe(true);
    expect(getSourceStatusView(stale, NOW)).toMatchObject({ label: "Upload unterbrochen", canRetry: true });
  });
});

describe("shouldPollSources", () => {
  it("fragt nur ab, solange etwas in Arbeit ist", () => {
    expect(shouldPollSources([], NOW)).toBe(false);
    expect(shouldPollSources([{ status: "ready", createdAt: at(0) }], NOW)).toBe(false);
    expect(shouldPollSources([{ status: "failed", createdAt: at(0) }], NOW)).toBe(false);
    expect(shouldPollSources([{ status: "ready", createdAt: at(0) }, { status: "processing", createdAt: at(0) }], NOW)).toBe(true);
    expect(shouldPollSources([{ status: "uploaded", createdAt: at(1000) }], NOW)).toBe(true);
  });

  it("hört bei hängengebliebenen Uploads auf, statt endlos abzufragen", () => {
    expect(shouldPollSources([{ status: "uploaded", createdAt: at(STALE_UPLOAD_MS + 1) }], NOW)).toBe(false);
  });
});

describe("Text-Quellen (US-08)", () => {
  it("zeigt bei fertigen Text-Quellen 'Text' statt einer Seitenzahl", () => {
    expect(getSourceStatusView({ ...base, type: "text", status: "ready", pageCount: null }, NOW).label).toBe("Text");
    expect(getSourceStatusView({ ...base, type: "pdf", status: "ready", pageCount: 3 }, NOW).label).toBe("3 Seiten");
  });
});
