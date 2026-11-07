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
  source: Pick<SourceSummary, "status" | "error" | "pageCount" | "createdAt">,
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
        label: source.pageCount === 1 ? "1 Seite" : `${source.pageCount ?? 0} Seiten`,
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
export function shouldPollSources(
  sources: Pick<SourceSummary, "status" | "createdAt">[],
  now = Date.now(),
): boolean {
  return sources.some(
    (source) => source.status === "processing" || (source.status === "uploaded" && !isStaleUpload(source, now)),
  );
}
