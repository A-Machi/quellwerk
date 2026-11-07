"use client";

import { FileText, Plus, Send, Sparkles } from "lucide-react";

import { Button } from "@/frontend/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/frontend/components/ui/resizable";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Textarea } from "@/frontend/components/ui/textarea";

// 3-Spalten-Layout eines Notebooks: Quellen · Chat · Studio.
// Noch ohne Daten, die Spalten werden in den User Stories gefüllt.
export function NotebookShell({ title }: { title: string }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <span className="font-semibold">Quellwerk</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="truncate text-muted-foreground">{title}</span>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="25%" minSize="15%">
          <Column title="Quellen">
            <div className="p-3">
              <Button variant="outline" className="w-full" disabled>
                <Plus />
                Quelle hinzufügen
              </Button>
            </div>
            <EmptyState
              icon={<FileText />}
              text="Noch keine Quellen. Lade ein PDF hoch, um zu starten."
            />
          </Column>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="50%" minSize="30%">
          <div className="flex h-full flex-col">
            <Column title="Chat">
              <EmptyState
                icon={<Sparkles />}
                text="Stelle eine Frage zu deinen Quellen. Die Antwort nennt, woher jede Aussage stammt."
              />
            </Column>
            <form className="flex shrink-0 gap-2 border-t p-3">
              <Textarea
                placeholder="Wähle zuerst eine Quelle aus"
                className="min-h-10 resize-none"
                disabled
              />
              <Button type="submit" size="icon" aria-label="Senden" disabled>
                <Send />
              </Button>
            </form>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="25%" minSize="15%">
          <Column title="Studio">
            <EmptyState
              icon={<Sparkles />}
              text="Zusammenfassungen, FAQ und Lernhilfen kommen in Phase 2."
            />
          </Column>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <h2 className="flex h-11 shrink-0 items-center border-b px-4 text-sm font-medium">
        {title}
      </h2>
      <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
    </section>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground [&_svg]:size-6">
      {icon}
      <p className="max-w-64">{text}</p>
    </div>
  );
}
