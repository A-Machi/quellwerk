"use client";

import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  PdfUploadRequest,
  PdfUploadTicket,
  SourceSummary,
} from "@/backend/sources/service";
import { useWorkspace } from "@/frontend/components/notebook/workspace-context";
import { SourceItem } from "@/frontend/components/sources/source-item";
import { Button } from "@/frontend/components/ui/button";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { shouldPollSources } from "@/frontend/lib/source-status";
import { createSupabaseBrowserClient } from "@/frontend/lib/supabase";
import { checkPdfFile } from "@/frontend/lib/upload";
import { cn } from "@/frontend/lib/utils";

type Result<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

export type SourceActions = {
  createUpload: (
    notebookId: string,
    file: PdfUploadRequest,
  ) => Promise<Result<PdfUploadTicket>>;
  rename: (id: string, title: string) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
};

const POLL_INTERVAL_MS = 2000;

export async function requestProcessing(sourceId: string): Promise<void> {
  const response = await fetch(`/api/sources/${sourceId}/process`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? "Die Verarbeitung konnte nicht gestartet werden.",
    );
  }
}

export function SourcePanel({
  notebookId,
  sources,
  actions,
}: {
  notebookId: string;
  sources: SourceSummary[];
  actions: SourceActions;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  // US-05: Status ohne Neuladen aktualisieren, solange etwas in Arbeit ist.
  const poll = uploading > 0 || shouldPollSources(sources);
  useEffect(() => {
    if (!poll) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll, router]);

  async function uploadOne(file: File) {
    const problem = checkPdfFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    const ticket = await actions.createUpload(notebookId, {
      fileName: file.name,
      size: file.size,
      type: file.type,
    });
    if (!ticket.ok) {
      toast.error(ticket.error);
      return;
    }
    router.refresh();

    const { error } = await createSupabaseBrowserClient()
      .storage.from("sources")
      .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
        contentType: "application/pdf",
      });
    if (error) toast.error(`„${file.name}“ konnte nicht hochgeladen werden.`);

    // Auch nach einem Fehler verarbeiten: die Quelle bekommt dann den Status
    // "failed" mit Grund, statt für immer auf "Wird hochgeladen" zu stehen.
    try {
      await requestProcessing(ticket.data.sourceId);
    } catch (processError) {
      toast.error((processError as Error).message);
    }
    router.refresh();
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading((n) => n + list.length);
    // Nacheinander, damit das Free-Tier-Kontingent nicht in Spitzen verbraucht wird.
    for (const file of list) {
      try {
        await uploadOne(file);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <div
      className={cn("flex min-h-full flex-col", dragging && "bg-muted/60")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void uploadFiles(event.dataTransfer.files);
      }}
    >
      <div className="p-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          hidden
          data-testid="source-file-input"
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          PDF hochladen
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          oder hierher ziehen · max. 50 MB pro Datei
        </p>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground [&_svg]:size-6">
          <FileText />
          <p className="max-w-64">
            Noch keine Quellen. Lade ein PDF hoch, um zu starten.
          </p>
        </div>
      ) : (
        <>
          <SelectAllRow />
          <ul className="flex flex-col gap-1 px-2 pb-3">
            {sources.map((source) => (
              <SourceItem
                key={source.id}
                source={source}
                onRetry={async () => {
                  try {
                    await requestProcessing(source.id);
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                  router.refresh();
                }}
                renameAction={actions.rename}
                deleteAction={actions.remove}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// US-07: alle fertigen Quellen auf einmal an- oder abwählen
function SelectAllRow() {
  const { allState, setAll, sources } = useWorkspace();
  const hasReady = sources.some((s) => s.status === "ready");

  return (
    <label className="flex items-center justify-between gap-2 border-y px-4 py-2 text-xs text-muted-foreground">
      Alle Quellen auswählen
      <Checkbox
        disabled={!hasReady}
        checked={allState === "all"}
        indeterminate={allState === "some"}
        onCheckedChange={(checked) => setAll(checked)}
      />
    </label>
  );
}
