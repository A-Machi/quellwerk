import { describe, expect, it } from "vitest";

import { describeSignInError, parseSignInForm } from "@/backend/auth";
import { UserFacingError } from "@/backend/errors";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("parseSignInForm", () => {
  it("liest E-Mail (getrimmt) und Passwort", () => {
    expect(parseSignInForm(form({ email: "  ich@example.com ", password: " geheim " }))).toEqual({
      email: "ich@example.com",
      password: " geheim ",
    });
  });

  it("lehnt ungültige E-Mail-Adressen ab", () => {
    expect(() => parseSignInForm(form({ email: "keine-mail", password: "x" }))).toThrow(
      "Bitte eine gültige E-Mail-Adresse eingeben.",
    );
  });

  it("verlangt ein Passwort", () => {
    expect(() => parseSignInForm(form({ email: "ich@example.com" }))).toThrow(UserFacingError);
    expect(() => parseSignInForm(form({ email: "ich@example.com", password: "" }))).toThrow(
      "Bitte das Passwort eingeben.",
    );
  });
});

describe("describeSignInError", () => {
  it("verrät nicht, ob es die E-Mail-Adresse gibt", () => {
    expect(describeSignInError({ status: 400, code: "invalid_credentials" })).toBe(
      "E-Mail oder Passwort ist falsch.",
    );
    expect(describeSignInError({ status: 400, code: "user_not_found" })).toBe("E-Mail oder Passwort ist falsch.");
  });

  it("meldet zu viele Versuche gesondert", () => {
    expect(describeSignInError({ status: 429 })).toContain("Zu viele Anmeldeversuche");
    expect(describeSignInError({ code: "over_request_rate_limit" })).toContain("Zu viele Anmeldeversuche");
  });
});
