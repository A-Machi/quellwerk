"use client";

import { BookOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { NotebookSummary } from "@/backend/notebooks/service";
import { ConfirmDeleteDialog } from "@/frontend/components/common/confirm-delete-dialog";
import { RenameDialog } from "@/frontend/components/common/rename-dialog";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { formatDate, formatSourceCount } from "@/frontend/lib/format";

type Result = { ok: true } | { ok: false; error: string };

export function NotebookGrid({
  notebooks,
  renameAction,
  deleteAction,
}: {
  notebooks: NotebookSummary[];
  renameAction: (id: string, title: string) => Promise<Result>;
  deleteAction: (id: string) => Promise<Result>;
}) {
  const [renaming, setRenaming] = useState<NotebookSummary | null>(null);
  const [deleting, setDeleting] = useState<NotebookSummary | null>(null);

  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
        <BookOpen className="size-6" />
        <p>Noch keine Notebooks. Lege dein erstes Notebook an, um Quellen hochzuladen.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notebooks.map((notebook) => (
          <li key={notebook.id}>
            <Card className="relative transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="truncate pr-8">
                  <Link href={`/notebooks/${notebook.id}`} className="after:absolute after:inset-0">
                    {notebook.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {formatSourceCount(notebook.sourceCount)} · {formatDate(notebook.updatedAt)}
                </CardDescription>
              </CardHeader>
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" aria-label={`Aktionen für ${notebook.title}`} />}
                  >
                    <MoreVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRenaming(notebook)}>
                      <Pencil />
                      Umbenennen
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(notebook)}>
                      <Trash2 />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <RenameDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Notebook umbenennen"
        initialValue={renaming?.title ?? ""}
        maxLength={200}
        onSubmit={(title) => renameAction(renaming!.id, title)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`„${deleting?.title ?? ""}“ löschen?`}
        description="Alle Quellen, hochgeladenen Dateien und der Chatverlauf dieses Notebooks werden endgültig gelöscht."
        onConfirm={() => deleteAction(deleting!.id)}
      />
    </>
  );
}
