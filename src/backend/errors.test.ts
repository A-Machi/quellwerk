import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GENERIC_ERROR_MESSAGE, toActionError, UserFacingError } from "@/backend/errors";

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("Es wurde nichts geworfen");
}

describe("toActionError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gibt die Meldung eines UserFacingError weiter", () => {
    expect(toActionError(new UserFacingError("Notebook wurde nicht gefunden."))).toEqual({
      ok: false,
      error: "Notebook wurde nicht gefunden.",
    });
  });

  it("ersetzt technische Fehler durch eine allgemeine Meldung und loggt sie", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("connection refused 10.0.0.1:5432");

    expect(toActionError(error)).toEqual({ ok: false, error: GENERIC_ERROR_MESSAGE });
    expect(log).toHaveBeenCalledWith(error);
  });

  it("lässt redirect() und notFound() durch, statt sie als Fehler zu melden", () => {
    const redirectError = thrownBy(() => redirect("/login"));
    const notFoundError = thrownBy(() => notFound());

    expect(() => toActionError(redirectError)).toThrow();
    expect(() => toActionError(notFoundError)).toThrow();
  });
});
