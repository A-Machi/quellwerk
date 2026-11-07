"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Input } from "@/frontend/components/ui/input";

type Result = { ok: true } | { ok: false; error: string };

export function RenameDialog({
  open,
  onOpenChange,
  title,
  initialValue,
  maxLength,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue: string;
  maxLength: number;
  onSubmit: (value: string) => Promise<Result>;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit(value);
      if (result.ok) onOpenChange(false);
      else toast.error(result.error);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(initialValue);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Neuer Name"
            value={value}
            maxLength={maxLength}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending || value.trim().length === 0}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
