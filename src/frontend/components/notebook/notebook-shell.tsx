"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/frontend/components/ui/resizable";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";

// 3-Spalten-Layout eines Notebooks: Quellen · Chat · Studio.
// Kopfzeile, Quellen- und Chat-Spalte kommen als fertige Elemente von der Seite.
export function NotebookShell({
  header,
  sources,
  chat,
  studio,
}: {
  header: React.ReactNode;
  sources: React.ReactNode;
  chat: React.ReactNode;
  studio: React.ReactNode;
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
          {chat}
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="25%" minSize="15%">
          {studio}
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
