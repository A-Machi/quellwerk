"use client";

import { Send, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Citation } from "@/backend/chat/prompt";
import type { SourcePassage } from "@/backend/sources/service";
import {
  ChatMessage,
  type UiMessage,
} from "@/frontend/components/chat/chat-message";
import { PassageDialog } from "@/frontend/components/chat/passage-dialog";
import { ConfirmDeleteDialog } from "@/frontend/components/common/confirm-delete-dialog";
import { useWorkspace } from "@/frontend/components/notebook/workspace-context";
import { Button } from "@/frontend/components/ui/button";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Textarea } from "@/frontend/components/ui/textarea";
import { readChatEvents } from "@/frontend/lib/chat-stream";
import { deriveTitle } from "@/frontend/lib/notes";

const GENERIC_ERROR =
  "Die Antwort konnte nicht erzeugt werden. Bitte versuche es erneut.";

type Result<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

export type ChatActions = {
  clear: (notebookId: string) => Promise<Result>;
  loadPassage: (chunkId: string) => Promise<Result<SourcePassage>>;
  saveNote: (
    notebookId: string,
    input: { title: string; content: string; citations: Citation[] },
  ) => Promise<Result<{ id: string }>>;
};

export function ChatPanel({
  initialMessages = [],
  actions,
}: {
  initialMessages?: UiMessage[];
  actions: ChatActions;
}) {
  const { notebookId, selectedIds, sources, registerAsk } = useWorkspace();
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const onOpenCitation = useCallback(
    (citation: Citation) => setOpenCitation(citation),
    [],
  );

  // US-17: Antwort als Notiz speichern, Titel aus der Frage davor
  const onSaveNote = useCallback(
    async (message: UiMessage) => {
      const index = messages.findIndex((m) => m.id === message.id);
      const question = messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user")?.content;
      const result = await actions.saveNote(notebookId, {
        title: deriveTitle(question ?? message.content),
        content: message.content,
        citations: message.citations,
      });
      if (result.ok) toast.success("Als Notiz gespeichert");
      else toast.error(result.error);
    },
    [actions, messages, notebookId],
  );

  const readyCount = sources.filter((s) => s.status === "ready").length;
  const canAsk = selectedIds.length > 0 && !busy;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const patch = (id: string, change: (m: UiMessage) => UiMessage) =>
    setMessages((all) => all.map((m) => (m.id === id ? change(m) : m)));

  async function ask(question: string) {
    const assistantId = crypto.randomUUID();
    setMessages((all) => [
      ...all,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        citations: [],
        status: "done",
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        citations: [],
        status: "streaming",
      },
    ]);
    setBusy(true);

    try {
      const response = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sourceIds: selectedIds }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? GENERIC_ERROR);
      }

      for await (const event of readChatEvents(response.body)) {
        if (event.type === "citations")
          patch(assistantId, (m) => ({ ...m, citations: event.citations }));
        else if (event.type === "text")
          patch(assistantId, (m) => ({
            ...m,
            content: m.content + event.delta,
          }));
        else if (event.type === "done")
          patch(assistantId, (m) => ({
            ...m,
            id: event.messageId ?? m.id,
            status: "done",
          }));
        else if (event.type === "error")
          patch(assistantId, (m) => ({
            ...m,
            status: "error",
            error: event.message,
          }));
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : GENERIC_ERROR;
      patch(assistantId, (m) => ({ ...m, status: "error", error: message }));
    } finally {
      // Falls der Stream ohne "done" endet (Verbindung weg)
      setMessages((all) =>
        all.map((m) =>
          m.status === "streaming"
            ? { ...m, status: "error", error: m.error ?? GENERIC_ERROR }
            : m,
        ),
      );
      setBusy(false);
      // Tagesverbrauch in der Kopfzeile aktualisieren
      router.refresh();
    }
  }

  // US-14: Klick auf ein Schlüsselthema stellt die Frage direkt im Chat.
  const latest = useRef({ ask, canAsk });
  useEffect(() => {
    latest.current = { ask, canAsk };
  });
  useEffect(() => {
    registerAsk((question) => {
      if (latest.current.canAsk) void latest.current.ask(question);
    });
    return () => registerAsk(null);
  }, [registerAsk]);

  function submit() {
    const question = input.trim();
    if (!question || !canAsk) return;
    setInput("");
    void ask(question);
  }

  const placeholder =
    readyCount === 0
      ? "Lade zuerst eine Quelle hoch"
      : selectedIds.length === 0
        ? "Wähle links mindestens eine Quelle aus"
        : "Frage zu deinen Quellen stellen …";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-medium">Chat</h2>
        {messages.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 />
            Chat leeren
          </Button>
        ) : null}
      </div>

      <ConfirmDeleteDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Chat leeren?"
        description="Alle Fragen und Antworten dieses Notebooks werden gelöscht. Die Quellen bleiben erhalten."
        onConfirm={async () => {
          const result = await actions.clear(notebookId);
          if (result.ok) setMessages([]);
          return result;
        }}
      />
      <PassageDialog
        citation={openCitation}
        onClose={() => setOpenCitation(null)}
        loadPassage={actions.loadPassage}
      />

      <ScrollArea className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground [&_svg]:size-6">
            <Sparkles />
            <p className="max-w-64">
              Stelle eine Frage zu deinen Quellen. Die Antwort nennt, woher jede
              Aussage stammt.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onOpenCitation={onOpenCitation}
                onSaveNote={onSaveNote}
              />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <form
        className="shrink-0 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            aria-label="Frage"
            maxLength={2000}
            disabled={selectedIds.length === 0}
            className="max-h-40 min-h-10 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Senden"
            disabled={!canAsk || !input.trim()}
          >
            <Send />
          </Button>
        </div>
        {readyCount > 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Durchsucht {selectedIds.length} von {readyCount}{" "}
            {readyCount === 1 ? "Quelle" : "Quellen"} - Enter sendet,
            Shift+Enter für neue Zeile
          </p>
        ) : null}
      </form>
    </section>
  );
}
