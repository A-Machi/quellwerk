import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/backend/supabase/database.types";

// Typisierter Supabase-Client. Services bekommen ihn als Parameter,
// damit Tests einen Client mit einem Test-Nutzer übergeben können.
export type AppSupabaseClient = SupabaseClient<Database>;

export type SourceStatus = "uploaded" | "processing" | "ready" | "failed";
export type SourceType = "pdf" | "text";

export const SOURCES_BUCKET = "sources";
