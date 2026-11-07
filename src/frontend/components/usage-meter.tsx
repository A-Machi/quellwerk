import { Gauge } from "lucide-react";

import { formatNeurons, usageLevel } from "@/frontend/lib/usage";
import { cn } from "@/frontend/lib/utils";

// US-21: Tagesverbrauch von Workers AI in der Kopfzeile
export function UsageMeter({ neurons, limit }: { neurons: number; limit: number }) {
  const level = usageLevel(neurons, limit);
  const percent = Math.min(100, Math.round((neurons / limit) * 100));

  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-md px-2 py-1 text-xs sm:flex",
        level === "ok" && "text-muted-foreground",
        level === "warning" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        level === "exhausted" && "bg-destructive/10 text-destructive",
      )}
      title="Verbrauch von Workers AI heute (seit 0:00 UTC). Embeddings sind geschätzt."
      data-testid="usage-meter"
      data-level={level}
    >
      <Gauge className="size-3.5" aria-hidden />
      <span>
        KI heute: {formatNeurons(neurons)} / {formatNeurons(limit)}
      </span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-current" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}
