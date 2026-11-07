import type { Citation } from "@/backend/chat/prompt";

// Antwort-Stream des Chat-Endpunkts: eine JSON-Zeile pro Ereignis (NDJSON).
// Zuerst die Zitate, dann die Text-Stücke, am Ende "done" oder "error".
export type ChatEvent =
  | { type: "citations"; citations: Citation[] }
  | { type: "text"; delta: string }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string };

export function encodeChatEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}
