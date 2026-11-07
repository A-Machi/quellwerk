import { describe, expect, it } from "vitest";

import { formatNeurons, usageLevel } from "@/frontend/lib/usage";

describe("usageLevel (US-21)", () => {
  it("warnt ab 80 % und meldet ab 100 % aufgebraucht", () => {
    expect(usageLevel(0, 10_000)).toBe("ok");
    expect(usageLevel(7_999, 10_000)).toBe("ok");
    expect(usageLevel(8_000, 10_000)).toBe("warning");
    expect(usageLevel(10_000, 10_000)).toBe("exhausted");
    expect(usageLevel(12_000, 10_000)).toBe("exhausted");
  });
});

describe("formatNeurons", () => {
  it("rundet und nutzt deutsche Tausenderpunkte", () => {
    expect(formatNeurons(1240.6)).toBe("1.241");
    expect(formatNeurons(10_000)).toBe("10.000");
  });
});
