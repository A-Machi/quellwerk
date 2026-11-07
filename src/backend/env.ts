import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CHAT_MODEL: z.string().min(1),
  EMBEDDING_MODEL: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

// Lazy, damit `next build` ohne gesetzte Variablen durchläuft.
// Fehlt etwas, schlägt erst der erste echte Aufruf fehl, mit klarer Meldung.
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Fehlende oder ungültige Env-Variablen: ${missing.join(", ")}. Siehe .env.example.`,
    );
  }

  cached = result.data;
  return cached;
}
