import { describe, expect, it } from "vitest";

import { topicQuestion } from "@/frontend/lib/topics";

describe("topicQuestion (US-14)", () => {
  it("baut die Frage zum Schlüsselthema", () => {
    expect(topicQuestion("  Prompt Injection ")).toBe("Was steht in den Quellen zu „Prompt Injection“?");
  });
});
