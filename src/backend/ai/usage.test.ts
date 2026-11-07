import { afterEach, describe, expect, it, vi } from "vitest";

import { createUsageRecorder, estimateNeurons, neuronsFromUsage, PRICES } from "@/backend/ai/usage";
import type { AppSupabaseClient } from "@/backend/supabase/types";

describe("estimateNeurons", () => {
  it("rechnet Token über den Preis in Neurons um (1.000 Neurons = 0,011 $)", () => {
    // 1 Mio. Input-Token zu 0,20 $ = 0,20 $ = 18.181,8 Neurons
    expect(estimateNeurons({ input: 1_000_000 }, PRICES.chat)).toBeCloseTo(18181.82, 1);
    // gemessene Chat-Frage: 6.741 Input + 172 Output = 127,25 Neurons laut Cloudflare
    expect(estimateNeurons({ input: 6741, output: 172 }, PRICES.chat)).toBeCloseTo(127.25, 0);
    expect(estimateNeurons({ input: 50_000 }, PRICES.embedding)).toBeCloseTo(53.6, 0);
  });
});

describe("neuronsFromUsage", () => {
  it("nimmt den echten Verbrauch aus den Cloudflare-Rohdaten", () => {
    expect(neuronsFromUsage({ inputTokens: 73, outputTokens: 33, raw: { neurons: 2.2272705 } })).toEqual({
      neurons: 2.2272705,
      estimated: false,
    });
  });

  it("schätzt aus den Token, wenn Cloudflare nichts meldet", () => {
    const result = neuronsFromUsage({ inputTokens: 6741, outputTokens: 172, raw: { prompt_tokens: 6741 } });
    expect(result.estimated).toBe(true);
    expect(result.neurons).toBeCloseTo(127.25, 0);
  });
});

describe("createUsageRecorder", () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeSupabase(error: unknown = null) {
    const insert = vi.fn().mockResolvedValue({ error });
    return { client: { from: vi.fn(() => ({ insert })) } as unknown as AppSupabaseClient, insert };
  }

  it("schreibt gerundeten Verbrauch in usage_log", async () => {
    const { client, insert } = fakeSupabase();
    await createUsageRecorder(client)("chat", 127.254417, false);
    expect(insert).toHaveBeenCalledWith({ kind: "chat", neurons: 127.2544, estimated: false });
  });

  it("protokolliert nichts bei 0 Neurons", async () => {
    const { client, insert } = fakeSupabase();
    await createUsageRecorder(client)("embedding", 0, true);
    expect(insert).not.toHaveBeenCalled();
  });

  it("bricht bei einem Datenbankfehler nicht ab, sondern loggt ihn", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase({ message: "kaputt" });
    await expect(createUsageRecorder(client)("chat", 5, false)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});
