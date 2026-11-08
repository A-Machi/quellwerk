import { notFound } from "next/navigation";
import { Suspense } from "react";

import { signOutAction } from "@/app/auth-actions";
import { UsageBadge } from "@/app/usage-badge";
import { UserBadge } from "@/app/user-badge";
import { renameNotebookAction } from "@/app/notebook-actions";
import {
  clearChatAction,
  getSourcePassageAction,
} from "@/app/notebooks/[id]/chat-actions";
import {
  createTextSourceAction,
  createUploadAction,
  deleteSourceAction,
  renameSourceAction,
} from "@/app/notebooks/[id]/source-actions";
import {
  createNoteAction,
  deleteNoteAction,
  noteToSourceAction,
  updateNoteAction,
} from "@/app/notebooks/[id]/note-actions";
import { requireSession } from "@/backend/auth";
import { listMessages } from "@/backend/chat/service";
import { listNotes } from "@/backend/notes/service";
import { getNotebook } from "@/backend/notebooks/service";
import { listSources } from "@/backend/sources/service";
import { AppHeader } from "@/frontend/components/app-header";
import { ChatPanel } from "@/frontend/components/chat/chat-panel";
import { NotebookShell } from "@/frontend/components/notebook/notebook-shell";
import { WorkspaceProvider } from "@/frontend/components/notebook/workspace-context";
import { NotebookTitle } from "@/frontend/components/notebooks/notebook-title";
import { SourcePanel } from "@/frontend/components/sources/source-panel";
import { StudioPanel } from "@/frontend/components/studio/studio-panel";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export default function NotebookPage({ params }: PageProps<"/notebooks/[id]">) {
  return (
    <Suspense fallback={<NotebookSkeleton />}>
      <NotebookView params={params} />
    </Suspense>
  );
}

async function NotebookView({
  params,
}: {
  params: PageProps<"/notebooks/[id]">["params"];
}) {
  const { id } = await params;
  const { supabase } = await requireSession();
  const notebook = await getNotebook(supabase, id);
  if (!notebook) notFound();
  const [sources, messages, notes] = await Promise.all([
    listSources(supabase, notebook.id),
    listMessages(supabase, notebook.id),
    listNotes(supabase, notebook.id),
  ]);

  return (
    <WorkspaceProvider notebookId={notebook.id} sources={sources}>
      <NotebookShell
        chat={
          <ChatPanel
            initialMessages={messages.map((m) => ({
              ...m,
              status: "done" as const,
            }))}
            actions={{
              clear: clearChatAction,
              loadPassage: getSourcePassageAction,
              saveNote: createNoteAction,
            }}
          />
        }
        studio={
          <StudioPanel
            notes={notes}
            actions={{
              create: createNoteAction,
              update: updateNoteAction,
              remove: deleteNoteAction,
              toSource: noteToSourceAction,
              loadPassage: getSourcePassageAction,
            }}
          />
        }
        header={
          <AppHeader
            signOutAction={signOutAction}
            usage={
              <Suspense fallback={null}>
                <UsageBadge />
              </Suspense>
            }
            user={
              <Suspense fallback={<Skeleton className="size-7 rounded-full" />}>
                <UserBadge />
              </Suspense>
            }
          >
            <NotebookTitle
              key={notebook.title}
              notebookId={notebook.id}
              title={notebook.title}
              renameAction={renameNotebookAction}
            />
          </AppHeader>
        }
        sources={
          <SourcePanel
            notebookId={notebook.id}
            sources={sources}
            actions={{
              createUpload: createUploadAction,
              createText: createTextSourceAction,
              rename: renameSourceAction,
              remove: deleteSourceAction,
            }}
          />
        }
      />
    </WorkspaceProvider>
  );
}

function NotebookSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid flex-1 grid-cols-4 gap-4 p-4">
        <Skeleton className="h-full" />
        <Skeleton className="col-span-2 h-full" />
        <Skeleton className="h-full" />
      </div>
    </div>
  );
}
