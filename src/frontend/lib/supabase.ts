import { createBrowserClient } from "@supabase/ssr";

// Supabase-Client für den Browser. Nutzt nur die öffentlichen Werte,
// alle Zugriffe sind durch Row Level Security geschützt.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt. Siehe .env.example.",
    );
  }

  return createBrowserClient(url, anonKey);
}
