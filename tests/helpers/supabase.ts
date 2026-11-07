import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/backend/supabase/database.types";
import { SOURCES_BUCKET, type AppSupabaseClient } from "@/backend/supabase/types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt. Integrationstests brauchen eine ausgefüllte .env.local.`);
  return value;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

// Admin-Client mit Secret Key: nur für Aufbau und Aufräumen der Tests.
export function adminClient(): AppSupabaseClient {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), clientOptions);
}

// Client ohne Login (nur Publishable Key), wie ein fremder Besucher.
export function anonClient(): AppSupabaseClient {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), clientOptions);
}

export type TestUser = {
  id: string;
  email: string;
  client: AppSupabaseClient;
  cleanup: () => Promise<void>;
};

// Legt einen echten, bestätigten Nutzer an und meldet ihn an.
// Die Registrierung ist für Besucher aus, der Admin-Client darf trotzdem Nutzer anlegen.
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `quellwerk-test-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `${randomUUID()}Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Test-Nutzer konnte nicht angelegt werden");
  const id = data.user.id;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(id);
    throw signInError;
  }

  return {
    id,
    email,
    client,
    cleanup: async () => {
      await removeUserFiles(admin, id);
      // Notebooks, Quellen, Chunks und Nachrichten verschwinden per Cascade.
      const { error: deleteError } = await admin.auth.admin.deleteUser(id);
      if (deleteError) throw deleteError;
    },
  };
}

async function removeUserFiles(admin: AppSupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(SOURCES_BUCKET);
  const { data: folders } = await bucket.list(userId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const prefix = `${userId}/${folder.name}`;
    const { data: files } = await bucket.list(prefix, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((file) => `${prefix}/${file.name}`));
  }
}

// Deterministische Fake-Embeddings: gleicher Text ergibt denselben Vektor.
// So testen wir die Pipeline ohne Workers AI und ohne Neurons zu verbrauchen.
export function fakeEmbedding(text: string): number[] {
  let seed = 0;
  for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 1024 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed >>> 8) / 0xffffff - 0.5) * (i % 7 === 0 ? 2 : 1);
  });
}

export const fakeEmbedder = async (texts: string[]) => texts.map(fakeEmbedding);
