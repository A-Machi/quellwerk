import type { ChatEvent } from "@/backend/chat/protocol";

// Liest den NDJSON-Stream des Chat-Endpunkts Zeile für Zeile.
// Zeilen und sogar einzelne Umlaute können über mehrere Netzwerk-Pakete verteilt ankommen.
export async function* readChatEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  const rest = buffer.trim();
  if (rest) yield JSON.parse(rest) as ChatEvent;
}
