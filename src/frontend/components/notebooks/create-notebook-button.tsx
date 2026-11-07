"use client";

import { Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/frontend/components/ui/button";

type Result = { ok: true } | { ok: false; error: string };

export function CreateNotebookButton({ action }: { action: () => Promise<Result> }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Bei Erfolg leitet die Action direkt zum neuen Notebook weiter.
          const result = await action();
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <Plus />
      {pending ? "Wird angelegt …" : "Neues Notebook"}
    </Button>
  );
}
