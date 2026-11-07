import { notFound } from "next/navigation";
import { Suspense } from "react";

import { signOutAction } from "@/app/auth-actions";
import { renameNotebookAction } from "@/app/notebook-actions";
import {
  createUploadAction,
  deleteSourceAction,
  renameSourceAction,
} from "@/app/notebooks/[id]/source-actions";
import { requireSession } from "@/backend/auth";
import { getNotebook } from "@/backend/notebooks/service";
import { listSources } from "@/backend/sources/service";
import { AppHeader } from "@/frontend/components/app-header";
import { ChatPanel } from "@/frontend/components/chat/chat-panel";
import { NotebookShell } from "@/frontend/components/notebook/notebook-shell";
import { WorkspaceProvider } from "@/frontend/components/notebook/workspace-context";
import { NotebookTitle } from "@/frontend/components/notebooks/notebook-title";
import { SourcePanel } from "@/frontend/components/sources/source-panel";
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
  const sources = await listSources(supabase, notebook.id);

  return (
    <WorkspaceProvider notebookId={notebook.id} sources={sources}>
      <NotebookShell
        chat={<ChatPanel />}
        header={
          <AppHeader signOutAction={signOutAction}>
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
