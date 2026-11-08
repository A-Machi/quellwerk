import { describe, expect, it } from "vitest";

import { avatarHue, initialsFromEmail } from "@/frontend/lib/user";

describe("initialsFromEmail", () => {
  it("nimmt Vor- und Nachname aus dem Teil vor dem @", () => {
    expect(initialsFromEmail("ayman.machi@systecs.com")).toBe("AM");
    expect(initialsFromEmail("max_mustermann@example.com")).toBe("MM");
    expect(initialsFromEmail("anna-lena.berg@example.com")).toBe("AL");
  });

  it("nimmt bei einem Wort die ersten beiden Buchstaben", () => {
    expect(initialsFromEmail("demo@quellwerk.com")).toBe("DE");
    expect(initialsFromEmail("x@example.com")).toBe("X");
  });

  it("liefert ein Fragezeichen, wenn nichts Brauchbares da ist", () => {
    expect(initialsFromEmail("@example.com")).toBe("?");
  });
});

describe("avatarHue", () => {
  it("ist für dieselbe Adresse immer gleich, unabhängig von Großschreibung", () => {
    expect(avatarHue("demo@quellwerk.com")).toBe(avatarHue("Demo@Quellwerk.com"));
  });

  it("liegt zwischen 0 und 359 und unterscheidet verschiedene Adressen", () => {
    const hues = ["demo@quellwerk.com", "ayman.machi@systecs.com", "test@example.com"].map(avatarHue);
    for (const hue of hues) expect(hue).toBeGreaterThanOrEqual(0), expect(hue).toBeLessThan(360);
    expect(new Set(hues).size).toBe(3);
  });
});
