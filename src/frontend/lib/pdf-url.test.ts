import { describe, expect, it } from "vitest";

import { pdfPageUrl } from "@/frontend/lib/pdf-url";

describe("pdfPageUrl (US-13)", () => {
  it("hängt die Seitenzahl als Fragment an und ersetzt ein vorhandenes", () => {
    const url = "https://x.supabase.co/storage/v1/object/sign/sources/a.pdf?token=abc";
    expect(pdfPageUrl(url, 12)).toBe(`${url}#page=12`);
    expect(pdfPageUrl(`${url}#page=3`, 5)).toBe(`${url}#page=5`);
  });

  it("öffnet ohne gültige Seitenzahl am Anfang", () => {
    expect(pdfPageUrl("https://a/b.pdf", null)).toBe("https://a/b.pdf");
    expect(pdfPageUrl("https://a/b.pdf", 0)).toBe("https://a/b.pdf");
  });
});
