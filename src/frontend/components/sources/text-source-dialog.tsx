"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { checkTextSource, MAX_TEXT_SOURCE_CHARS } from "@/frontend/lib/upload";

// US-08: kopierten Text als Quelle einfügen
export function TextSourceDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; text: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = checkTextSource({ title, text });
    if (problem) {
      toast.error(problem);
      return;
    }
    startTransition(async () => {
      if (await onSubmit({ title: title.trim(), text })) {
        setTitle("");
        setText("");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Text als Quelle einfügen</DialogTitle>
            <DialogDescription>
              Zum Beispiel Notizen, eine E-Mail oder einen Artikel. Der Text wird wie ein PDF durchsuchbar gemacht.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="text-source-title">Titel</Label>
            <Input
              id="text-source-title"
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Besprechungsnotizen Mai"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="text-source-text">Text</Label>
            <Textarea
              id="text-source-text"
              value={text}
              maxLength={MAX_TEXT_SOURCE_CHARS}
              onChange={(event) => setText(event.target.value)}
              className="h-64 resize-y"
            />
            <p className="text-right text-xs text-muted-foreground">
              {text.length.toLocaleString("de-DE")} / {MAX_TEXT_SOURCE_CHARS.toLocaleString("de-DE")} Zeichen
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Wird hinzugefügt …" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
