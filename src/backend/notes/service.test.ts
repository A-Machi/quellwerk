import { describe, expect, it } from "vitest";

import { deriveNoteTitle, MAX_NOTE_CHARS, parseNoteInput } from "@/backend/notes/service";
import { deriveTitle } from "@/frontend/lib/notes";

describe("parseNoteInput (US-18)", () => {
  it("trimmt Titel und Inhalt", () => {
    expect(parseNoteInput({ title: " Idee ", content: " Text " })).toEqual({ title: "Idee", content: "Text" });
  });

  it("lehnt leere oder zu lange Notizen ab", () => {
    expect(() => parseNoteInput({ title: "", content: "x" })).toThrow("Bitte gib einen Titel ein.");
    expect(() => parseNoteInput({ title: "T", content: "  " })).toThrow("Die Notiz darf nicht leer sein.");
    expect(() => parseNoteInput({ title: "T", content: "x".repeat(MAX_NOTE_CHARS + 1) })).toThrow("zu lang");
  });
});

describe("Titel aus Text ableiten (US-17)", () => {
  it("nimmt die Frage, kürzt lange Texte und nutzt einen Ersatztitel", () => {
    expect(deriveNoteTitle("  Wie hoch\nwar der Umsatz? ")).toBe("Wie hoch war der Umsatz?");
    expect(deriveNoteTitle("x".repeat(200))).toHaveLength(119);
    expect(deriveNoteTitle("   ")).toBe("Notiz");
  });

  it("verhält sich im Browser genauso wie im Backend", () => {
    for (const text of ["Kurz", "x".repeat(200), "  ", "Zeile\nzwei"]) {
      expect(deriveTitle(text)).toBe(deriveNoteTitle(text));
    }
  });
});
