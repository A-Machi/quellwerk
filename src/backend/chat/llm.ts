import "server-only";

import { generateText, streamText } from "ai";

import { getChatModel } from "@/backend/ai/provider";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type LlmRequest = { instructions: string; messages: ChatMessage[] };

// Schmale Schnittstelle zum Sprachmodell, damit Tests ein Fake-Modell übergeben können.
export type ChatLlm = {
  stream(request: LlmRequest): AsyncIterable<string>;
  complete(request: LlmRequest): Promise<string>;
};

// gpt-oss ist ein Reasoning-Modell: "low" hält Wartezeit und Verbrauch klein.
const CALL_OPTIONS = { reasoning: "low", temperature: 0.2, maxRetries: 2 } as const;

export function createWorkersAiLlm(): ChatLlm {
  const model = getChatModel();

  return {
    async *stream({ instructions, messages }) {
      const result = streamText({ model, instructions, messages, maxOutputTokens: 2000, ...CALL_OPTIONS });
      // streamText wirft nicht, Fehler kommen als Teil des Streams.
      for await (const part of result.stream) {
        if (part.type === "text-delta") yield part.text;
        else if (part.type === "error") throw part.error;
      }
    },

    async complete({ instructions, messages }) {
      const { text } = await generateText({ model, instructions, messages, maxOutputTokens: 300, ...CALL_OPTIONS });
      return text;
    },
  };
}
