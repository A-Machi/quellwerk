export type UsageLevel = "ok" | "warning" | "exhausted";

// Ab 80 % warnen, ab 100 % ist das Kontingent für heute aufgebraucht.
export function usageLevel(neurons: number, limit: number): UsageLevel {
  if (neurons >= limit) return "exhausted";
  if (neurons >= limit * 0.8) return "warning";
  return "ok";
}

export function formatNeurons(neurons: number): string {
  return Math.round(neurons).toLocaleString("de-DE");
}
