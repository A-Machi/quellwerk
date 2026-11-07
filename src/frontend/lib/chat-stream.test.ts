import { describe, expect, it } from "vitest";

import { encodeChatEvent, type ChatEvent } from "@/backend/chat/protocol";
import { readChatEvents } from "@/frontend/lib/chat-stream";

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of readChatEvents(stream)) events.push(event);
  return events;
}

const events: ChatEvent[] = [
  { type: "citations", citations: [] },
  { type: "text", delta: "Die Bäckerei " },
  { type: "text", delta: "wächst [1]." },
  { type: "done", messageId: null },
];

describe("readChatEvents", () => {
  it("liest alle Ereignisse in Reihenfolge", async () => {
    const bytes = new TextEncoder().encode(events.map(encodeChatEvent).join(""));
    expect(await collect(streamOf([bytes]))).toEqual(events);
  });

  it("setzt Zeilen und Umlaute zusammen, die auf mehrere Pakete verteilt sind", async () => {
    const bytes = new TextEncoder().encode(events.map(encodeChatEvent).join(""));
    // Byte für Byte: zerschneidet jede Zeile und das zweibytige "ä"
    const parts = Array.from(bytes, (byte) => new Uint8Array([byte]));
    expect(await collect(streamOf(parts))).toEqual(events);
  });

  it("liest auch eine letzte Zeile ohne Zeilenumbruch", async () => {
    const bytes = new TextEncoder().encode('{"type":"error","message":"Tageslimit"}');
    expect(await collect(streamOf([bytes]))).toEqual([{ type: "error", message: "Tageslimit" }]);
  });
});
