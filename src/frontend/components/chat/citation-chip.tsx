"use client";

import type { Citation } from "@/backend/chat/prompt";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/frontend/components/ui/tooltip";

export function citationLabel(citation: Pick<Citation, "sourceTitle" | "pageNumber">): string {
  return citation.pageNumber == null ? citation.sourceTitle : `${citation.sourceTitle}, S. ${citation.pageNumber}`;
}

// US-12: Zitat-Marker als Chip. Hover zeigt Quelle, Seite und Textausschnitt.
export function CitationChip({
  citation,
  onOpen,
}: {
  citation: Citation;
  onOpen?: (citation: Citation) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onOpen?.(citation)}
            aria-label={`Quelle ${citation.n}: ${citationLabel(citation)}`}
            className="mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full bg-primary/10 px-1.5 align-middle text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          />
        }
      >
        {citation.n}
      </TooltipTrigger>
      <TooltipContent className="max-w-80 text-left">
        <p className="font-semibold">{citationLabel(citation)}</p>
        <p className="mt-1 opacity-90">„{citation.excerpt}“</p>
      </TooltipContent>
    </Tooltip>
  );
}
