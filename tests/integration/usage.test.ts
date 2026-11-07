import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createUsageRecorder, getTodayUsage } from "@/backend/ai/usage";
import { adminClient, anonClient, createTestUser, type TestUser } from "@tests/helpers/supabase";

// V-09 und US-21 gegen die echte Datenbank
describe("Verbrauchsprotokoll", () => {
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    user = await createTestUser("usage");
    other = await createTestUser("usage-other");
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  it("summiert den heutigen Verbrauch des eigenen Nutzers", async () => {
    expect(await getTodayUsage(user.client)).toBe(0);
    const record = createUsageRecorder(user.client);
    await record("chat", 127.25, false);
    await record("embedding", 0.5, true);
    expect(await getTodayUsage(user.client)).toBeCloseTo(127.75, 4);
  });

  it("zählt Verbrauch von gestern nicht mit (Reset um 0:00 UTC)", async () => {
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const { error } = await adminClient()
      .from("usage_log")
      .insert({ user_id: user.id, kind: "chat", neurons: 5000, created_at: yesterday });
    expect(error).toBeNull();
    expect(await getTodayUsage(user.client)).toBeCloseTo(127.75, 4);
  });

  it("andere Nutzer sehen fremden Verbrauch nicht und können keinen fremden eintragen", async () => {
    expect(await getTodayUsage(other.client)).toBe(0);
    const { data } = await other.client.from("usage_log").select("id");
    expect(data).toEqual([]);
    const { error } = await other.client.from("usage_log").insert({ user_id: user.id, kind: "chat", neurons: 1 });
    expect(error?.code).toBe("42501");
  });

  it("Besucher ohne Login haben keinen Zugriff", async () => {
    const { error } = await anonClient().rpc("usage_today");
    expect(error).not.toBeNull();
  });
});
