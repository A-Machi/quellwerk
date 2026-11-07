import { describe, expect, it } from "vitest";

import { UserFacingError } from "@/backend/errors";
import {
  MAX_TEXT_SOURCE_CHARS,
  MAX_UPLOAD_BYTES,
  parseSourceTitle,
  parseTextSource,
  validatePdfUpload,
} from "@/backend/sources/service";
import {
  MAX_TEXT_SOURCE_CHARS as CLIENT_MAX_TEXT_CHARS,
  MAX_UPLOAD_BYTES as CLIENT_MAX_UPLOAD_BYTES,
} from "@/frontend/lib/upload";

describe("validatePdfUpload", () => {
  it("leitet den Titel aus dem Dateinamen ab", () => {
    expect(validatePdfUpload({ fileName: "Jahresbericht 2025.pdf", size: 1000, type: "application/pdf" })).toEqual({
      title: "Jahresbericht 2025",
    });
    expect(validatePdfUpload({ fileName: "SCAN.PDF", size: 1, type: "" }).title).toBe("SCAN");
  });

  it("nutzt einen Ersatztitel, wenn der Dateiname nur aus der Endung besteht", () => {
    expect(validatePdfUpload({ fileName: ".pdf", size: 1, type: "application/pdf" }).title).toBe("Unbenannte Quelle");
  });

  it("kürzt sehr lange Dateinamen auf 300 Zeichen", () => {
    const result = validatePdfUpload({ fileName: `${"a".repeat(400)}.pdf`, size: 1, type: "application/pdf" });
    expect(result.title).toHaveLength(300);
  });

  it.each([
    [{ fileName: "bild.png", size: 10, type: "image/png" }, "ist kein PDF"],
    [{ fileName: "getarnt.pdf", size: 10, type: "text/html" }, "ist kein PDF"],
    [{ fileName: "leer.pdf", size: 0, type: "application/pdf" }, "ist leer"],
    [{ fileName: "riesig.pdf", size: MAX_UPLOAD_BYTES + 1, type: "application/pdf" }, "größer als 50 MB"],
  ])("lehnt %o ab", (request, message) => {
    expect(() => validatePdfUpload(request)).toThrow(UserFacingError);
    expect(() => validatePdfUpload(request)).toThrow(message);
  });

  it("akzeptiert genau 50 MB", () => {
    expect(() => validatePdfUpload({ fileName: "a.pdf", size: MAX_UPLOAD_BYTES, type: "application/pdf" })).not.toThrow();
  });

  it("nutzt dieselbe Größengrenze wie die Vorprüfung im Browser", () => {
    expect(CLIENT_MAX_UPLOAD_BYTES).toBe(MAX_UPLOAD_BYTES);
  });
});

describe("parseSourceTitle", () => {
  it("trimmt und prüft die Länge", () => {
    expect(parseSourceTitle("  Vertrag  ")).toBe("Vertrag");
    expect(() => parseSourceTitle("   ")).toThrow("darf nicht leer sein");
    expect(() => parseSourceTitle("x".repeat(301))).toThrow("höchstens 300");
  });
});

describe("parseTextSource (US-08)", () => {
  it("trimmt Titel und Text und prüft die Grenzen", () => {
    expect(parseTextSource({ title: " Notiz ", text: "  Ein Text mit genug Zeichen.  " })).toEqual({
      title: "Notiz",
      text: "Ein Text mit genug Zeichen.",
    });
    expect(() => parseTextSource({ title: "", text: "Ein Text mit genug Zeichen." })).toThrow("darf nicht leer sein");
    expect(() => parseTextSource({ title: "Notiz", text: "kurz" })).toThrow("mindestens 20 Zeichen");
    expect(() => parseTextSource({ title: "Notiz", text: "x".repeat(MAX_TEXT_SOURCE_CHARS + 1) })).toThrow("höchstens");
  });

  it("nutzt dieselbe Längengrenze wie die Vorprüfung im Browser", () => {
    expect(CLIENT_MAX_TEXT_CHARS).toBe(MAX_TEXT_SOURCE_CHARS);
  });
});
