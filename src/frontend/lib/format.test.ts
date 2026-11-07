import { describe, expect, it } from "vitest";

import { formatDate, formatSourceCount } from "@/frontend/lib/format";

describe("formatDate", () => {
  it("formatiert deutsch in Berliner Zeit", () => {
    expect(formatDate("2026-11-07T12:00:00Z")).toBe("7. Nov. 2026");
    // 23:30 UTC am 31.12. ist in Berlin schon der 1.1.
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("1. Jan. 2027");
  });
});

describe("formatSourceCount", () => {
  it("unterscheidet Einzahl und Mehrzahl", () => {
    expect(formatSourceCount(0)).toBe("0 Quellen");
    expect(formatSourceCount(1)).toBe("1 Quelle");
    expect(formatSourceCount(3)).toBe("3 Quellen");
  });
});
