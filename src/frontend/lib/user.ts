// Initialen aus der E-Mail: "ayman.machi@…" -> "AM", "demo@…" -> "DE"
export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local
    .split(/[._\-+]+/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part));
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : (parts[0] ?? local).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

// Gleiche E-Mail ergibt immer denselben Farbton (0-359) für den Avatar.
export function avatarHue(email: string): number {
  let hash = 0;
  for (const char of email.toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}
