import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnv } from "@/backend/env";
import type { Database } from "@/backend/supabase/database.types";
import type { AppSupabaseClient } from "@/backend/supabase/types";

// Supabase-Client mit der Session des eingeloggten Nutzers.
// Alle Abfragen laufen durch Row Level Security.
export async function createSupabaseServerClient(): Promise<AppSupabaseClient> {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden.
            // Die Session wird dann vom Proxy (src/proxy.ts) erneuert.
          }
        },
      },
    },
  );
}
