"use client";

import { Send, Sparkles } from "lucide-react";

import { Button } from "@/frontend/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/frontend/components/ui/resizable";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Textarea } from "@/frontend/components/ui/textarea";

// 3-Spalten-Layout eines Notebooks: Quellen · Chat · Studio.
// Kopfzeile und Quellen-Spalte kommen als fertige Elemente von der Seite.
export function NotebookShell({
  header,
  sources,
}: {
  header: React.ReactNode;
  sources: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      {header}

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="25%" minSize="15%">
          <Column title="Quellen">{sources}</Column>
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
                placeholder="Der Chat kommt in Sprint 3"
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
