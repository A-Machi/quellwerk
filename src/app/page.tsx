import { Suspense } from "react";

import { signOutAction } from "@/app/auth-actions";
import { UsageBadge } from "@/app/usage-badge";
import {
  createNotebookAction,
  deleteNotebookAction,
  renameNotebookAction,
} from "@/app/notebook-actions";
import { requireSession } from "@/backend/auth";
import { listNotebooks } from "@/backend/notebooks/service";
import { AppHeader } from "@/frontend/components/app-header";
import { CreateNotebookButton } from "@/frontend/components/notebooks/create-notebook-button";
import { NotebookGrid } from "@/frontend/components/notebooks/notebook-grid";
import { Skeleton } from "@/frontend/components/ui/skeleton";

// US-02: Übersicht aller Notebooks
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signOutAction={signOutAction}
        usage={
          <Suspense fallback={null}>
            <UsageBadge />
          </Suspense>
        }
      />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Notebooks</h1>
          <CreateNotebookButton action={createNotebookAction} />
        </div>
        <Suspense fallback={<NotebookGridSkeleton />}>
          <NotebookList />
        </Suspense>
      </main>
    </div>
  );
}

async function NotebookList() {
  const { supabase } = await requireSession();
  const notebooks = await listNotebooks(supabase);
  return (
    <NotebookGrid
      notebooks={notebooks}
      renameAction={renameNotebookAction}
      deleteAction={deleteNotebookAction}
    />
  );
}

function NotebookGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}
