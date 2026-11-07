import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { getServerEnv } from "@/backend/env";

// Cloudflare Workers AI über den OpenAI-kompatiblen Endpoint.
// Nur Modelle mit Open-Source-Lizenz verwenden (siehe CLAUDE.md).
function getWorkersAI() {
  const env = getServerEnv();

  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    apiKey: env.CLOUDFLARE_API_TOKEN,
  });
}

export function getChatModel() {
  return getWorkersAI().chatModel(getServerEnv().CHAT_MODEL);
}

export function getEmbeddingModel() {
  return getWorkersAI().embeddingModel(getServerEnv().EMBEDDING_MODEL);
}
