import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

import { UserFacingError } from "@/backend/errors";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import type { AppSupabaseClient } from "@/backend/supabase/types";

export type CurrentUser = { id: string; email: string | null };

export type Session = { supabase: AppSupabaseClient; user: CurrentUser };

// Liest den Nutzer aus dem Session-Cookie. getClaims() prüft die Signatur des JWT.
export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, user: { id: data.claims.sub, email } };
}

// Für Seiten und Server Actions: ohne Login geht es zur Login-Seite.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export const signInSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(1, "Bitte das Passwort eingeben."),
});

export function parseSignInForm(formData: FormData) {
  const result = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.success) {
    throw new UserFacingError(result.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  return result.data;
}

// Übersetzt Fehler von Supabase Auth in verständliche Meldungen.
// Verrät nie, ob es die E-Mail-Adresse gibt.
export function describeSignInError(error: { status?: number; code?: string }): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Zu viele Anmeldeversuche. Bitte warte kurz und versuche es erneut.";
  }
  if (error.code === "email_not_confirmed") {
    return "Diese E-Mail-Adresse ist noch nicht bestätigt.";
  }
  return "E-Mail oder Passwort ist falsch.";
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new UserFacingError(describeSignInError(error));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
