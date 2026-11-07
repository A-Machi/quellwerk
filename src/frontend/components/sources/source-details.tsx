"use client";

import { Loader2, RotateCw, Sparkles } from "lucide-react";
import { useTransition } from "react";

import type { SourceSummary } from "@/backend/sources/service";
import { useWorkspace } from "@/frontend/components/notebook/workspace-context";
import { Button } from "@/frontend/components/ui/button";
import { topicQuestion } from "@/frontend/lib/topics";

// US-14: Zusammenfassung und Schlüsselthemen einer Quelle. Klick auf ein Thema
// stellt im Chat die Frage dazu.
export function SourceDetails({
  source,
  onSummarize,
}: {
  source: SourceSummary;
  onSummarize: () => Promise<void>;
}) {
  const { ask, isSelected } = useWorkspace();
  const [pending, startSummarize] = useTransition();
  const running = pending || source.summaryStatus === "pending";

  return (
    <div className="mt-2 ml-6 flex flex-col gap-2 rounded-md border bg-background/60 p-3 text-xs" data-testid="source-details">
      {running ? (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Zusammenfassung wird erstellt …
        </p>
      ) : source.summaryStatus === "ready" && source.summary ? (
        <>
          <p className="leading-relaxed text-foreground">{source.summary}</p>
          {source.keyTopics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {source.keyTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  disabled={!isSelected(source.id)}
                  title={isSelected(source.id) ? `Im Chat fragen: ${topicQuestion(topic)}` : "Quelle ist im Chat abgewählt"}
                  onClick={() => ask(topicQuestion(topic))}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-primary/10 disabled:hover:text-primary"
                >
                  {topic}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">
          {source.summaryStatus === "failed"
            ? "Die Zusammenfassung konnte nicht erstellt werden (evtl. Tageslimit erreicht)."
            : "Noch keine Zusammenfassung vorhanden."}
        </p>
      )}

      {!running ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto self-start px-0 text-xs"
          onClick={() => startSummarize(onSummarize)}
        >
          {source.summaryStatus === "ready" ? <RotateCw className="size-3" /> : <Sparkles className="size-3" />}
          {source.summaryStatus === "ready" ? "Neu erzeugen" : "Zusammenfassung erzeugen"}
          <span className="text-muted-foreground">(ca. 240 Neurons)</span>
        </Button>
      ) : null}
    </div>
  );
}
