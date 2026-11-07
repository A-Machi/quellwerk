import "server-only";

import { generateText, streamText } from "ai";

import { getChatModel } from "@/backend/ai/provider";
import { neuronsFromUsage, type UsageKind, type UsageRecorder } from "@/backend/ai/usage";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type LlmRequest = {
  instructions: string;
  messages: ChatMessage[];
  // Wofür der Verbrauch protokolliert wird (Standard: chat bzw. rewrite)
  usageKind?: UsageKind;
  maxOutputTokens?: number;
};

// Schmale Schnittstelle zum Sprachmodell, damit Tests ein Fake-Modell übergeben können.
export type ChatLlm = {
  stream(request: LlmRequest): AsyncIterable<string>;
  complete(request: LlmRequest): Promise<string>;
};

// gpt-oss ist ein Reasoning-Modell: "low" hält Wartezeit und Verbrauch klein.
const CALL_OPTIONS = { reasoning: "low", temperature: 0.2, maxRetries: 2 } as const;

export function createWorkersAiLlm(recordUsage?: UsageRecorder): ChatLlm {
  const model = getChatModel();
  const record = async (kind: UsageKind, usage: Parameters<typeof neuronsFromUsage>[0]) => {
    if (!recordUsage) return;
    const { neurons, estimated } = neuronsFromUsage(usage);
    await recordUsage(kind, neurons, estimated);
  };

  return {
    async *stream({ instructions, messages, usageKind = "chat", maxOutputTokens = 2000 }) {
      const result = streamText({ model, instructions, messages, maxOutputTokens, ...CALL_OPTIONS });
      // streamText wirft nicht, Fehler kommen als Teil des Streams.
      for await (const part of result.stream) {
        if (part.type === "text-delta") yield part.text;
        else if (part.type === "error") throw part.error;
      }
      await record(usageKind, await result.usage);
    },

    async complete({ instructions, messages, usageKind = "rewrite", maxOutputTokens = 300 }) {
      const result = await generateText({ model, instructions, messages, maxOutputTokens, ...CALL_OPTIONS });
      await record(usageKind, result.usage);
      return result.text;
    },
  };
}
