import "server-only";

import { unstable_rethrow } from "next/navigation";

// Fehler, deren Meldung dem Nutzer direkt angezeigt werden darf.
// Alle anderen Fehler werden geloggt und durch eine allgemeine Meldung ersetzt.
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export const GENERIC_ERROR_MESSAGE =
  "Etwas ist schiefgelaufen. Bitte versuche es erneut.";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function toActionError(error: unknown): { ok: false; error: string } {
  // redirect() und notFound() werfen intern. Diese Fehler müssen durch.
  unstable_rethrow(error);
  if (error instanceof UserFacingError) {
    return { ok: false, error: error.message };
  }
  console.error(error);
  return { ok: false, error: GENERIC_ERROR_MESSAGE };
}
