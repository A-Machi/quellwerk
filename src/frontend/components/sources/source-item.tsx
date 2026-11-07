"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";

import type { SourceSummary } from "@/backend/sources/service";
import { ConfirmDeleteDialog } from "@/frontend/components/common/confirm-delete-dialog";
import { RenameDialog } from "@/frontend/components/common/rename-dialog";
import { useWorkspace } from "@/frontend/components/notebook/workspace-context";
import { SourceDetails } from "@/frontend/components/sources/source-details";
import { Button } from "@/frontend/components/ui/button";
import { Checkbox } from "@/frontend/components/ui/checkbox";
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
  onSummarize,
  renameAction,
  deleteAction,
}: {
  source: SourceSummary;
  onRetry: () => Promise<void>;
  onSummarize: () => Promise<void>;
  renameAction: (id: string, title: string) => Promise<Result>;
  deleteAction: (id: string) => Promise<Result>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, startRetry] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const status = getSourceStatusView(source);
  const { isSelected, toggle } = useWorkspace();

  return (
    <li
      className="group rounded-lg px-2 py-2 hover:bg-muted/60"
      data-testid="source-item"
      data-status={source.status}
    >
      <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">
        {status.tone === "busy" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : status.tone === "error" ? (
          <AlertCircle className="text-destructive" aria-hidden />
        ) : source.type === "text" ? (
          <ClipboardPaste aria-hidden />
        ) : (
          <FileText aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1 text-left text-sm font-medium disabled:cursor-default"
          title={source.title}
          disabled={source.status !== "ready"}
          aria-expanded={source.status === "ready" ? expanded : undefined}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="truncate">{source.title}</span>
          {source.status === "ready" ? (
            <ChevronDown
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          ) : null}
        </button>
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            status.tone === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {status.tone === "ready" ? (
            <CheckCircle2 className="size-3" aria-hidden />
          ) : null}
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

      <Checkbox
        className="mt-1"
        aria-label={`„${source.title}“ im Chat verwenden`}
        disabled={source.status !== "ready"}
        checked={source.status === "ready" && isSelected(source.id)}
        onCheckedChange={(checked) => toggle(source.id, checked)}
      />

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
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      </div>
      {expanded && source.status === "ready" ? <SourceDetails source={source} onSummarize={onSummarize} /> : null}

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
