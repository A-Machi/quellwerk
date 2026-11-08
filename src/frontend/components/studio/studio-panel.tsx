"use client";

import { BookOpen, CalendarClock, ClipboardList, HelpCircle, Loader2, Plus, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Citation } from "@/backend/chat/prompt";
import type { NoteKind, StoredNote } from "@/backend/notes/service";
import type { SourcePassage } from "@/backend/sources/service";
import type { StudioKind } from "@/backend/studio/prompt";
import { CitationMarkdown } from "@/frontend/components/chat/chat-message";
import { PassageDialog } from "@/frontend/components/chat/passage-dialog";
import { ConfirmDeleteDialog } from "@/frontend/components/common/confirm-delete-dialog";
import { useWorkspace } from "@/frontend/components/notebook/workspace-context";
import { requestProcessing } from "@/frontend/components/sources/source-panel";
import { NoteDialog } from "@/frontend/components/studio/note-dialog";
import { NoteEditorDialog } from "@/frontend/components/studio/note-editor-dialog";
import { Button } from "@/frontend/components/ui/button";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { readChatEvents } from "@/frontend/lib/chat-stream";
import { formatDate } from "@/frontend/lib/format";
import { NOTE_KIND_LABELS, STUDIO_NEURON_ESTIMATE, STUDIO_TILES } from "@/frontend/lib/notes";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type NoteActions = {
  create: (notebookId: string, input: { title: string; content: string }) => Promise<Result<{ id: string }>>;
  update: (id: string, input: { title: string; content: string }) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  toSource: (id: string) => Promise<Result<{ sourceId: string }>>;
  loadPassage: (chunkId: string) => Promise<Result<SourcePassage>>;
};

const KIND_ICONS: Record<NoteKind, typeof StickyNote> = {
  note: StickyNote,
  faq: HelpCircle,
  briefing: ClipboardList,
  study_guide: BookOpen,
  timeline: CalendarClock,
};

type Live = { kind: StudioKind; content: string; citations: Citation[] };

const GENERIC_ERROR = "Die Ausgabe konnte nicht erzeugt werden. Bitte versuche es erneut.";

// US-15 bis US-19: Studio-Spalte mit Kacheln, laufender Ausgabe und Notizen
export function StudioPanel({ notes, actions }: { notes: StoredNote[]; actions: NoteActions }) {
  const router = useRouter();
  const { notebookId, selectedIds } = useWorkspace();
  const [live, setLive] = useState<Live | null>(null);
  const [opened, setOpened] = useState<StoredNote | null>(null);
  const [editing, setEditing] = useState<StoredNote | "new" | null>(null);
  const [deleting, setDeleting] = useState<StoredNote | null>(null);
  const [citation, setCitation] = useState<Citation | null>(null);

  const busy = live !== null;
  const canGenerate = selectedIds.length > 0 && !busy;

  async function generate(kind: StudioKind) {
    setOpened(null);
    setLive({ kind, content: "", citations: [] });
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sourceIds: selectedIds }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? GENERIC_ERROR);
      }
      for await (const event of readChatEvents(response.body)) {
        if (event.type === "citations") setLive((l) => l && { ...l, citations: event.citations });
        else if (event.type === "text") setLive((l) => l && { ...l, content: l.content + event.delta });
        else if (event.type === "error") throw new Error(event.message);
        else if (event.type === "done") toast.success(`${NOTE_KIND_LABELS[kind]} erstellt`);
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : GENERIC_ERROR);
    } finally {
      setLive(null);
      router.refresh();
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <h2 className="flex h-11 shrink-0 items-center border-b px-4 text-sm font-medium">Studio</h2>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <div>
            <div className="grid grid-cols-2 gap-2">
              {STUDIO_TILES.map((tile) => {
                const Icon = KIND_ICONS[tile.kind];
                return (
                  <button
                    key={tile.kind}
                    type="button"
                    disabled={!canGenerate}
                    onClick={() => void generate(tile.kind)}
                    className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {live?.kind === tile.kind ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                      {tile.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{tile.description}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedIds.length === 0
                ? "Wähle links mindestens eine Quelle aus."
                : `Aus ${selectedIds.length} ${selectedIds.length === 1 ? "Quelle" : "Quellen"} - ca. ${STUDIO_NEURON_ESTIMATE} Neurons pro Ausgabe`}
            </p>
          </div>

          {live ? (
            <div className="rounded-lg border bg-muted/30 p-3" data-testid="studio-live">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {NOTE_KIND_LABELS[live.kind]} wird erstellt …
              </p>
              {live.content ? <CitationMarkdown content={live.content} citations={live.citations} /> : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notizen und Ausgaben</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditing("new")}>
              <Plus />
              Neue Notiz
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Noch nichts gespeichert. Erzeuge eine Ausgabe oder speichere eine Chat-Antwort als Notiz.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notes.map((note) => {
                const Icon = KIND_ICONS[note.kind];
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setOpened(note)}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{note.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {NOTE_KIND_LABELS[note.kind]} - {formatDate(note.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>

      <NoteDialog
        note={opened}
        onClose={() => setOpened(null)}
        onOpenCitation={setCitation}
        onEdit={(note) => {
          setOpened(null);
          setEditing(note);
        }}
        onDelete={(note) => setDeleting(note)}
        onRegenerate={(note) => {
          if (note.kind !== "note") void generate(note.kind);
        }}
        onAddAsSource={async (note) => {
          const result = await actions.toSource(note.id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Notiz wird als Quelle hinzugefügt");
          setOpened(null);
          router.refresh();
          requestProcessing(result.data.sourceId)
            .catch((error: Error) => toast.error(error.message))
            .finally(() => router.refresh());
        }}
      />

      <NoteEditorDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing && editing !== "new" ? { title: editing.title, content: editing.content } : undefined}
        onSubmit={async (input) => {
          const result =
            editing && editing !== "new" ? await actions.update(editing.id, input) : await actions.create(notebookId, input);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Notiz gespeichert");
          return true;
        }}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`„${deleting?.title ?? ""}“ löschen?`}
        description="Die Notiz wird endgültig gelöscht."
        onConfirm={async () => {
          const result = await actions.remove(deleting!.id);
          if (result.ok) setOpened(null);
          return result;
        }}
      />

      <PassageDialog citation={citation} onClose={() => setCitation(null)} loadPassage={actions.loadPassage} />
    </section>
  );
}
