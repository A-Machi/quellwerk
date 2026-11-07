import { describe, expect, it } from "vitest";

import { parseDeselected, selectAllState, selectedSourceIds } from "@/frontend/lib/source-selection";

const sources = [
  { id: "a", status: "ready" as const },
  { id: "b", status: "ready" as const },
  { id: "c", status: "processing" as const },
  { id: "d", status: "failed" as const },
];

describe("selectedSourceIds", () => {
  it("wählt standardmäßig alle fertigen Quellen aus, nie unfertige", () => {
    expect(selectedSourceIds(sources, new Set())).toEqual(["a", "b"]);
  });

  it("lässt abgewählte Quellen weg", () => {
    expect(selectedSourceIds(sources, new Set(["a"]))).toEqual(["b"]);
  });

  it("wählt eine neu fertig gewordene Quelle automatisch mit aus", () => {
    const later = sources.map((s) => (s.id === "c" ? { ...s, status: "ready" as const } : s));
    expect(selectedSourceIds(later, new Set(["a"]))).toEqual(["b", "c"]);
  });
});

describe("selectAllState", () => {
  it("unterscheidet alle, einige und keine", () => {
    expect(selectAllState(sources, new Set())).toBe("all");
    expect(selectAllState(sources, new Set(["a"]))).toBe("some");
    expect(selectAllState(sources, new Set(["a", "b"]))).toBe("none");
    expect(selectAllState([{ id: "c", status: "processing" }], new Set())).toBe("none");
  });
});

describe("parseDeselected", () => {
  it("liest gespeicherte Auswahl und verkraftet kaputte Werte", () => {
    expect(parseDeselected('["a","b"]')).toEqual(new Set(["a", "b"]));
    expect(parseDeselected('["a", 3, null]')).toEqual(new Set(["a"]));
    expect(parseDeselected("kein json")).toEqual(new Set());
    expect(parseDeselected('{"a":1}')).toEqual(new Set());
    expect(parseDeselected(null)).toEqual(new Set());
  });
});
