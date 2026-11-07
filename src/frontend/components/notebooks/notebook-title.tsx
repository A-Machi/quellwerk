"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result = { ok: true } | { ok: false; error: string };

// Notebook-Titel in der Kopfzeile, per Klick editierbar.
// Enter oder Verlassen des Felds speichert, Escape bricht ab.
export function NotebookTitle({
  notebookId,
  title,
  renameAction,
}: {
  notebookId: string;
  title: string;
  renameAction: (id: string, title: string) => Promise<Result>;
}) {
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const next = value.trim();
    if (!next || next === title) {
      setValue(title);
      return;
    }
    startTransition(async () => {
      const result = await renameAction(notebookId, next);
      if (!result.ok) {
        toast.error(result.error);
        setValue(title);
      }
    });
  };

  return (
    <input
      aria-label="Notebook-Titel"
      value={value}
      maxLength={200}
      disabled={pending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setValue(title);
          requestAnimationFrame(() => event.currentTarget?.blur());
        }
      }}
      className="w-full truncate rounded-md bg-transparent px-1 py-0.5 text-muted-foreground outline-none hover:bg-muted focus:bg-muted focus:text-foreground"
    />
  );
}
