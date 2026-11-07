"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2, MoreVertical, Pencil, RotateCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import type { SourceSummary } from "@/backend/sources/service";
import { ConfirmDeleteDialog } from "@/frontend/components/common/confirm-delete-dialog";
import { RenameDialog } from "@/frontend/components/common/rename-dialog";
import { Button } from "@/frontend/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { getSourceStatusView } from "@/frontend/lib/source-status";
import { cn } from "@/frontend/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

export function SourceItem({
  source,
  onRetry,
  renameAction,
  deleteAction,
}: {
  source: SourceSummary;
  onRetry: () => Promise<void>;
  renameAction: (id: string, title: string) => Promise<Result>;
  deleteAction: (id: string) => Promise<Result>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, startRetry] = useTransition();
  const status = getSourceStatusView(source);

  return (
    <li
      className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-muted/60"
      data-testid="source-item"
      data-status={source.status}
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">
        {status.tone === "busy" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : status.tone === "error" ? (
          <AlertCircle className="text-destructive" aria-hidden />
        ) : (
          <FileText aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={source.title}>
          {source.title}
        </p>
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            status.tone === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status.tone === "ready" ? <CheckCircle2 className="size-3" aria-hidden /> : null}
          {status.label}
        </p>
        {status.canRetry ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            disabled={retrying}
            onClick={() => startRetry(onRetry)}
          >
            <RotateCw className={cn("size-3", retrying && "animate-spin")} />
            Erneut verarbeiten
          </Button>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-60 group-hover:opacity-100"
              aria-label={`Aktionen für ${source.title}`}
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Quelle umbenennen"
        initialValue={source.title}
        maxLength={300}
        onSubmit={(title) => renameAction(source.id, title)}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`„${source.title}“ löschen?`}
        description="Die Datei und alle daraus erzeugten Textabschnitte werden endgültig gelöscht."
        onConfirm={() => deleteAction(source.id)}
      />
    </li>
  );
}
