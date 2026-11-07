import { describe, expect, it } from "vitest";

import { citationNumberFromHref, citedNumbers, linkCitations } from "@/frontend/lib/citations";

const valid = new Set([1, 2, 3]);

describe("linkCitations", () => {
  it("macht aus [n] einen Link auf das Zitat", () => {
    expect(linkCitations("Der Umsatz stieg [1].", valid)).toBe("Der Umsatz stieg [1](#cite-1).");
  });

  it("versteht Listen, Folgen und die Schreibweise von gpt-oss", () => {
    expect(linkCitations("A [1, 3] B [2][3] C 【2】 D 【1†L3-L5】", valid)).toBe(
      "A [1](#cite-1)[3](#cite-3) B [2](#cite-2)[3](#cite-3) C [2](#cite-2) D [1](#cite-1)",
    );
  });

  it("entfernt Nummern, zu denen es keine Quelle gibt", () => {
    expect(linkCitations("Erfunden [7] und echt [2, 9].", valid)).toBe("Erfunden  und echt [2](#cite-2).");
  });

  it("lässt normale Markdown-Links, Fußnoten und Text in Klammern in Ruhe", () => {
    const text = "Siehe [Website](https://example.com), Fußnote [^1] und [Hinweis].";
    expect(linkCitations(text, valid)).toBe(text);
  });
});

describe("citedNumbers", () => {
  it("liefert die tatsächlich zitierten Nummern ohne Doppelte", () => {
    expect(citedNumbers("A [2] B [1, 2] C 【3】 D [8]", valid)).toEqual([2, 1, 3]);
    expect(citedNumbers("Keine Belege.", valid)).toEqual([]);
  });
});

describe("citationNumberFromHref", () => {
  it("erkennt nur Zitat-Links", () => {
    expect(citationNumberFromHref("#cite-4")).toBe(4);
    expect(citationNumberFromHref("https://example.com")).toBeNull();
    expect(citationNumberFromHref(undefined)).toBeNull();
  });
});
