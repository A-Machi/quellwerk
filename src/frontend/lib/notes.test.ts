import { describe, expect, it } from "vitest";

import { isStudioKind, NOTE_KIND_LABELS, STUDIO_TILES } from "@/frontend/lib/notes";

describe("Studio-Kacheln (US-15)", () => {
  it("zeigt die vier Ausgaben in der entschiedenen Reihenfolge", () => {
    expect(STUDIO_TILES.map((t) => t.kind)).toEqual(["faq", "briefing", "study_guide", "timeline"]);
    for (const tile of STUDIO_TILES) expect(NOTE_KIND_LABELS[tile.kind]).toBe(tile.label);
  });

  it("unterscheidet eigene Notizen von Studio-Ausgaben", () => {
    expect(isStudioKind("note")).toBe(false);
    expect(isStudioKind("faq")).toBe(true);
  });
});
