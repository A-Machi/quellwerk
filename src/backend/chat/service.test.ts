import { describe, expect, it } from "vitest";

import { CHAT_MESSAGES, describeChatError, parseChatRequest } from "@/backend/chat/service";
import { UserFacingError } from "@/backend/errors";

const id = "0b9a6f1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("parseChatRequest", () => {
  it("trimmt die Frage und akzeptiert gültige Quellen-IDs", () => {
    expect(parseChatRequest({ question: "  Was steht drin?  ", sourceIds: [id] })).toEqual({
      question: "Was steht drin?",
      sourceIds: [id],
    });
  });

  it.each([
    [{ question: "", sourceIds: [id] }, "Bitte gib eine Frage ein."],
    [{ question: "x".repeat(2001), sourceIds: [id] }, "höchstens 2000 Zeichen"],
    [{ question: "Frage", sourceIds: [] }, "Wähle mindestens eine Quelle aus."],
    [{ question: "Frage", sourceIds: ["kein-uuid"] }, ""],
    [null, ""],
  ])("lehnt %o ab", (input, message) => {
    expect(() => parseChatRequest(input)).toThrow(UserFacingError);
    if (message) expect(() => parseChatRequest(input)).toThrow(message);
  });
});

describe("describeChatError", () => {
  it("gibt Nutzerfehler weiter, erkennt das Tageslimit und versteckt Technisches", () => {
    expect(describeChatError(new UserFacingError("Notebook wurde nicht gefunden."))).toBe("Notebook wurde nicht gefunden.");
    expect(describeChatError(new Error("AiError: 4006: daily free allocation exceeded"))).toBe(CHAT_MESSAGES.quota);
    expect(describeChatError(new Error("socket hang up"))).toBe(CHAT_MESSAGES.generic);
  });
});
