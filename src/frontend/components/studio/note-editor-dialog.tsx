"use client";

import { useState, useTransition } from "react";

import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";

// US-18: eigene Notiz anlegen oder bearbeiten (Markdown)
export function NoteEditorDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { title: string; content: string };
  onSubmit: (input: { title: string; content: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle(initial?.title ?? "");
          setContent(initial?.content ?? "");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              if (await onSubmit({ title, content })) onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{initial ? "Notiz bearbeiten" : "Neue Notiz"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-title">Titel</Label>
            <Input id="note-title" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-content">Text (Markdown möglich)</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-64 resize-y font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending || !title.trim() || !content.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
