import { describe, expect, it } from "vitest";

import { extractSearchTerms } from "@/backend/search/keywords";

describe("extractSearchTerms (US-20)", () => {
  it("entfernt deutsche und englische Füllwörter", () => {
    expect(extractSearchTerms("Was steht in den Quellen zu Improper Output Handling?")).toEqual([
      "improper",
      "output",
      "handling",
    ]);
    expect(extractSearchTerms("What is the risk of prompt injection?")).toEqual(["risk", "prompt", "injection"]);
  });

  it("behält Kennungen, Nummern und Bindestrich-Begriffe samt Teilen", () => {
    expect(extractSearchTerms("Was steht zu LLM05 und GPT-4 in 2025?")).toEqual(["llm05", "gpt-4", "gpt", "2025"]);
  });

  it("entfernt Doppelte und begrenzt auf 12 Begriffe", () => {
    expect(extractSearchTerms("Umsatz Umsatz umsatz")).toEqual(["umsatz"]);
    const many = Array.from({ length: 20 }, (_, i) => `begriff${i}`).join(" ");
    expect(extractSearchTerms(many)).toHaveLength(12);
  });

  it("liefert für reine Füllwörter nichts", () => {
    expect(extractSearchTerms("Was ist das?")).toEqual([]);
  });
});
