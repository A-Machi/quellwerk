"use client";

import { Copy, FilePlus2, Pencil, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Citation } from "@/backend/chat/prompt";
import type { StoredNote } from "@/backend/notes/service";
import { CitationMarkdown } from "@/frontend/components/chat/chat-message";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { formatDate } from "@/frontend/lib/format";
import { isStudioKind, NOTE_KIND_LABELS } from "@/frontend/lib/notes";

// US-16 und US-18: Notiz oder Studio-Ausgabe lesen und bearbeiten
export function NoteDialog({
  note,
  onClose,
  onOpenCitation,
  onEdit,
  onDelete,
  onRegenerate,
  onAddAsSource,
}: {
  note: StoredNote | null;
  onClose: () => void;
  onOpenCitation: (citation: Citation) => void;
  onEdit: (note: StoredNote) => void;
  onDelete: (note: StoredNote) => void;
  onRegenerate: (note: StoredNote) => void;
  onAddAsSource: (note: StoredNote) => void;
}) {
  return (
    <Dialog open={note !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {note ? (
          <>
            <DialogHeader>
              <DialogTitle>{note.title}</DialogTitle>
              <DialogDescription>
                {NOTE_KIND_LABELS[note.kind]} · {formatDate(note.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="note-content">
              <CitationMarkdown content={note.content} citations={note.citations} onOpenCitation={onOpenCitation} />
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(note.content);
                      toast.success("Als Markdown kopiert");
                    } catch {
                      toast.error("Kopieren nicht möglich");
                    }
                  }}
                >
                  <Copy />
                  Als Markdown kopieren
                </Button>
                {isStudioKind(note.kind) ? (
                  <Button variant="outline" size="sm" onClick={() => onRegenerate(note)}>
                    <RotateCw />
                    Neu erzeugen
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => onEdit(note)}>
                      <Pencil />
                      Bearbeiten
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onAddAsSource(note)}>
                      <FilePlus2 />
                      Als Quelle hinzufügen
                    </Button>
                  </>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(note)}>
                <Trash2 />
                Löschen
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
