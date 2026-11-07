import { describe, expect, it } from "vitest";

import { UserFacingError } from "@/backend/errors";
import { parseId, parseNotebookTitle } from "@/backend/notebooks/service";

describe("parseNotebookTitle", () => {
  it("trimmt den Titel", () => {
    expect(parseNotebookTitle("  Steuer 2025  ")).toBe("Steuer 2025");
  });

  it("lehnt leere und zu lange Titel mit verständlicher Meldung ab", () => {
    expect(() => parseNotebookTitle("")).toThrow(UserFacingError);
    expect(() => parseNotebookTitle("   ")).toThrow("Der Titel darf nicht leer sein.");
    expect(() => parseNotebookTitle("x".repeat(201))).toThrow("höchstens 200 Zeichen");
    expect(parseNotebookTitle("x".repeat(200))).toHaveLength(200);
  });

  it("lehnt Nicht-Strings ab", () => {
    expect(() => parseNotebookTitle(undefined)).toThrow(UserFacingError);
    expect(() => parseNotebookTitle(42)).toThrow(UserFacingError);
  });
});

describe("parseId", () => {
  it("akzeptiert UUIDs und lehnt alles andere als 'nicht gefunden' ab", () => {
    const id = "0b9a6f1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(parseId(id)).toBe(id);
    expect(() => parseId("1; drop table notebooks", "Notebook")).toThrow("Notebook wurde nicht gefunden.");
    expect(() => parseId(undefined)).toThrow(UserFacingError);
  });
});
