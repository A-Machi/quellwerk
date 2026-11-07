import { describe, expect, it } from "vitest";

import type { RetrievedChunk } from "@/backend/chat/prompt";
import {
  buildStudioInstructions,
  buildStudioPrompt,
  STUDIO_KINDS,
  STUDIO_TYPES,
  studioSearchQuery,
  studioTitle,
} from "@/backend/studio/prompt";
import { parseStudioRequest } from "@/backend/studio/service";

const chunk: RetrievedChunk = {
  id: "c1",
  sourceId: "s1",
  sourceTitle: "OWASP",
  pageNumber: 12,
  content: "Improper Output Handling.",
  similarity: 0.9,
};

describe("Studio-Prompts (US-15)", () => {
  it("hat für jede Ausgabe eine eigene Aufgabe und die gemeinsamen Regeln", () => {
    expect(STUDIO_KINDS).toEqual(["faq", "briefing", "study_guide", "timeline"]);
    for (const kind of STUDIO_KINDS) {
      const instructions = buildStudioInstructions(kind);
      expect(instructions).toContain(STUDIO_TYPES[kind].task);
      expect(instructions).toContain("[1]");
      expect(instructions).toContain("Deutsch");
    }
    expect(buildStudioInstructions("timeline")).toContain("Keine datierten Ereignisse gefunden.");
  });

  it("gibt Zusammenfassungen ohne Nummer und Abschnitte nummeriert mit Seite mit", () => {
    const prompt = buildStudioPrompt(
      [
        { title: "OWASP", summary: "Risiken von LLMs.", keyTopics: ["Prompt Injection"] },
        { title: "Notiz", summary: null, keyTopics: [] },
      ],
      [chunk, { ...chunk, pageNumber: null, sourceTitle: "Notiz", content: "Text." }],
    );
    expect(prompt).toBe(
      "Zusammenfassungen der Quellen:\n- OWASP (Themen: Prompt Injection): Risiken von LLMs.\n- Notiz: keine Zusammenfassung vorhanden\n\n" +
        "Nummerierte Abschnitte:\n\n[1] (OWASP, Seite 12)\nImproper Output Handling.\n\n[2] (Notiz)\nText.",
    );
  });

  it("sucht mit der Aufgabe und den Schlüsselthemen der Quellen", () => {
    const query = studioSearchQuery("faq", [{ title: "A", summary: null, keyTopics: ["Prompt Injection", "RAG"] }]);
    expect(query).toBe(`${STUDIO_TYPES.faq.searchQuery} Prompt Injection RAG`);
  });

  it("baut einen lesbaren Titel aus Typ und Quellen", () => {
    expect(studioTitle("faq", ["OWASP"])).toBe("FAQ: OWASP");
    expect(studioTitle("briefing", ["A", "B"])).toBe("Briefing: A, B");
    expect(studioTitle("timeline", ["A", "B", "C"])).toBe("Zeitleiste: A und 2 weitere");
    expect(studioTitle("study_guide", ["x".repeat(400)]).length).toBeLessThanOrEqual(300);
  });
});

describe("parseStudioRequest", () => {
  const id = "0b9a6f1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
  it("akzeptiert bekannte Ausgaben und verlangt Quellen", () => {
    expect(parseStudioRequest({ kind: "faq", sourceIds: [id] })).toEqual({ kind: "faq", sourceIds: [id] });
    expect(() => parseStudioRequest({ kind: "podcast", sourceIds: [id] })).toThrow("Unbekannte Studio-Ausgabe.");
    expect(() => parseStudioRequest({ kind: "faq", sourceIds: [] })).toThrow("Wähle mindestens eine Quelle aus.");
  });
});
