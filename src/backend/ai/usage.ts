import "server-only";

import type { AppSupabaseClient } from "@/backend/supabase/types";

// Free Tier von Workers AI: 10.000 Neurons pro Tag, Zurücksetzen um 0:00 UTC
export const DAILY_NEURON_LIMIT = 10_000;

// Preise laut Cloudflare-Modellsuche (US-Dollar pro 1 Mio. Token), 1.000 Neurons = 0,011 $
const USD_PER_NEURON = 0.011 / 1000;
export const PRICES = {
  chat: { input: 0.2, output: 0.3 },
  embedding: { input: 0.0118, output: 0 },
} as const;

export type UsageKind = "chat" | "rewrite" | "embedding" | "summary" | "studio";

export type UsageRecorder = (kind: UsageKind, neurons: number, estimated: boolean) => Promise<void>;

export function estimateNeurons(
  tokens: { input: number; output?: number },
  price: { input: number; output: number },
): number {
  const usd = (tokens.input * price.input + (tokens.output ?? 0) * price.output) / 1_000_000;
  return usd / USD_PER_NEURON;
}

// Cloudflare meldet den echten Verbrauch im Feld "neurons" der Rohdaten.
// Fehlt er, wird aus den Token geschätzt.
export function neuronsFromUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  raw?: unknown;
}): { neurons: number; estimated: boolean } {
  const raw = usage.raw as { neurons?: unknown } | undefined;
  if (raw && typeof raw.neurons === "number" && Number.isFinite(raw.neurons)) {
    return { neurons: raw.neurons, estimated: false };
  }
  return {
    neurons: estimateNeurons({ input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 }, PRICES.chat),
    estimated: true,
  };
}

// Schreibt in usage_log, mit der Session des Nutzers (RLS: nur eigene Zeilen).
// Ein Fehler beim Protokollieren darf nie die eigentliche Funktion abbrechen.
export function createUsageRecorder(supabase: AppSupabaseClient): UsageRecorder {
  return async (kind, neurons, estimated) => {
    if (!(neurons > 0)) return;
    const { error } = await supabase
      .from("usage_log")
      .insert({ kind, neurons: Math.round(neurons * 10_000) / 10_000, estimated });
    if (error) console.error("Verbrauch konnte nicht protokolliert werden", error);
  };
}

export async function getTodayUsage(supabase: AppSupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("usage_today");
  if (error) throw error;
  return Number(data ?? 0);
}
