"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { Citation } from "@/backend/chat/prompt";
import type { SourcePassage } from "@/backend/sources/service";
import { citationLabel } from "@/frontend/components/chat/citation-chip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/frontend/components/ui/dialog";
import { pdfPageUrl } from "@/frontend/lib/pdf-url";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; passage: SourcePassage }
  | { status: "error"; error: string };

// US-13: Klick auf ein Zitat zeigt die Stelle. PDFs öffnen sich auf der zitierten Seite,
// daneben steht der zitierte Abschnitt. Text-Quellen zeigen den Abschnitt selbst.
export function PassageDialog({
  citation,
  onClose,
  loadPassage,
}: {
  citation: Citation | null;
  onClose: () => void;
  loadPassage: (chunkId: string) => Promise<Result<SourcePassage>>;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const chunkId = citation?.chunkId;

  useEffect(() => {
    if (!chunkId) return;
    let cancelled = false;
    loadPassage(chunkId).then(
      (result) => {
        if (cancelled) return;
        setState(result.ok ? { status: "ready", passage: result.data } : { status: "error", error: result.error });
      },
      () => !cancelled && setState({ status: "error", error: "Die Stelle konnte nicht geladen werden." }),
    );
    return () => {
      cancelled = true;
      setState({ status: "loading" });
    };
  }, [chunkId, loadPassage]);

  const passage = state.status === "ready" ? state.passage : null;
  const pdfUrl = passage?.fileUrl ? pdfPageUrl(passage.fileUrl, passage.pageNumber) : null;

  return (
    <Dialog open={citation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{citation ? citationLabel(citation) : ""}</DialogTitle>
          <DialogDescription>Quelle {citation?.n}</DialogDescription>
        </DialogHeader>

        {state.status === "loading" ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="text-destructive">
            {state.error}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
            {pdfUrl ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <iframe
                  src={pdfUrl}
                  title={`${passage!.sourceTitle}, Seite ${passage!.pageNumber ?? 1}`}
                  className="min-h-0 w-full flex-1 rounded-md border bg-muted"
                />
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground underline underline-offset-2"
                >
                  <ExternalLink className="size-3" />
                  In neuem Tab öffnen
                </a>
              </div>
            ) : null}
            <aside className={pdfUrl ? "md:w-80" : "flex-1"}>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Zitierte Stelle</p>
              <blockquote
                data-testid="cited-passage"
                className="max-h-full overflow-y-auto rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm leading-relaxed whitespace-pre-wrap"
              >
                {passage!.content}
              </blockquote>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
