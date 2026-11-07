import type { SourceSummary } from "@/backend/sources/service";

export type SourceStatusView = {
  label: string;
  tone: "busy" | "ready" | "error";
  // Quelle kann (noch) nicht für den Chat genutzt werden
  busy: boolean;
  canRetry: boolean;
};

// Nach dieser Zeit gilt eine Quelle im Status "uploaded" als hängen geblieben,
// z. B. weil der Tab während des Uploads geschlossen wurde.
export const STALE_UPLOAD_MS = 5 * 60 * 1000;

export function isStaleUpload(source: Pick<SourceSummary, "status" | "createdAt">, now = Date.now()): boolean {
  return source.status === "uploaded" && now - new Date(source.createdAt).getTime() > STALE_UPLOAD_MS;
}

export function getSourceStatusView(
  source: Pick<SourceSummary, "status" | "error" | "pageCount" | "createdAt"> & { type?: SourceSummary["type"] },
  now = Date.now(),
): SourceStatusView {
  switch (source.status) {
    case "uploaded":
      return isStaleUpload(source, now)
        ? { label: "Upload unterbrochen", tone: "error", busy: false, canRetry: true }
        : { label: "Wird hochgeladen …", tone: "busy", busy: true, canRetry: false };
    case "processing":
      return { label: "Wird verarbeitet …", tone: "busy", busy: true, canRetry: false };
    case "ready":
      return {
        label:
          source.type === "text"
            ? "Text"
            : source.pageCount === 1
              ? "1 Seite"
              : `${source.pageCount ?? 0} Seiten`,
        tone: "ready",
        busy: false,
        canRetry: false,
      };
    case "failed":
      return {
        label: source.error ?? "Verarbeitung fehlgeschlagen",
        tone: "error",
        busy: false,
        canRetry: true,
      };
  }
}

// Solange eine Quelle hochgeladen oder verarbeitet wird, fragt die Seite den Status ab.
// Nach dieser Zeit wird auf eine automatische Zusammenfassung nicht mehr gewartet.
export const SUMMARY_WAIT_MS = 10 * 60 * 1000;

export function shouldPollSources(
  sources: (Pick<SourceSummary, "status" | "createdAt"> & Partial<Pick<SourceSummary, "summaryStatus">>)[],
  now = Date.now(),
): boolean {
  return sources.some(
    (source) =>
      source.status === "processing" ||
      (source.status === "uploaded" && !isStaleUpload(source, now)) ||
      // US-14: Zusammenfassung läuft nach der Verarbeitung im Hintergrund
      (source.summaryStatus === "pending" && now - new Date(source.createdAt).getTime() < SUMMARY_WAIT_MS),
  );
}
