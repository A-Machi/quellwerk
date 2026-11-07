import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, createTestUser, type TestUser } from "@tests/helpers/supabase";

// Sicherheit: Jeder Nutzer sieht und ändert nur seine eigenen Daten.
// Läuft gegen die echte Supabase-Datenbank mit zwei temporären Nutzern.
describe("Row Level Security", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceNotebookId: string;
  let aliceSourceId: string;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");

    const { data: notebook, error } = await alice.client
      .from("notebooks")
      .insert({ title: "Geheimes Notebook" })
      .select("id")
      .single();
    if (error) throw error;
    aliceNotebookId = notebook.id;

    const { data: source, error: sourceError } = await alice.client
      .from("sources")
      .insert({
        notebook_id: aliceNotebookId,
        type: "pdf",
        title: "Geheim",
        storage_path: `${alice.id}/${aliceNotebookId}/x.pdf`,
      })
      .select("id")
      .single();
    if (sourceError) throw sourceError;
    aliceSourceId = source.id;
  });

  afterAll(async () => {
    await alice?.cleanup();
    await bob?.cleanup();
  });

  it("setzt user_id automatisch auf den eingeloggten Nutzer", async () => {
    const { data } = await alice.client.from("notebooks").select("user_id").eq("id", aliceNotebookId).single();
    expect(data?.user_id).toBe(alice.id);
  });

  it("zeigt fremde Notebooks und Quellen nicht an", async () => {
    const notebooks = await bob.client.from("notebooks").select("id").eq("id", aliceNotebookId);
    const sources = await bob.client.from("sources").select("id").eq("id", aliceSourceId);
    expect(notebooks.data).toEqual([]);
    expect(sources.data).toEqual([]);
  });

  it("verhindert, dass ein anderer Nutzer fremde Notebooks ändert oder löscht", async () => {
    const update = await bob.client.from("notebooks").update({ title: "Gehackt" }).eq("id", aliceNotebookId).select("id");
    const remove = await bob.client.from("notebooks").delete().eq("id", aliceNotebookId).select("id");
    expect(update.data).toEqual([]);
    expect(remove.data).toEqual([]);

    const { data } = await alice.client.from("notebooks").select("title").eq("id", aliceNotebookId).single();
    expect(data?.title).toBe("Geheimes Notebook");
  });

  it("verhindert Quellen in fremden Notebooks", async () => {
    const { error } = await bob.client.from("sources").insert({
      notebook_id: aliceNotebookId,
      type: "pdf",
      title: "Untergeschoben",
      storage_path: `${bob.id}/${aliceNotebookId}/y.pdf`,
    });
    expect(error?.code).toBe("42501");
  });

  it("verhindert, dass user_id auf einen anderen Nutzer gefälscht wird", async () => {
    const { error } = await bob.client.from("notebooks").insert({ title: "Fake", user_id: alice.id });
    expect(error?.code).toBe("42501");
  });

  it("verhindert Chunks an fremden Quellen", async () => {
    const { error } = await bob.client.from("chunks").insert({
      source_id: aliceSourceId,
      chunk_index: 0,
      content: "x",
      token_count: 1,
      embedding: JSON.stringify(Array(1024).fill(0)),
    });
    expect(error?.code).toBe("42501");
  });

  it("sperrt Besucher ohne Login komplett aus", async () => {
    const anon = anonClient();
    for (const table of ["notebooks", "sources", "chunks", "messages"] as const) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
    const insert = await anon.from("notebooks").insert({ title: "Anonym" });
    expect(insert.error?.code).toBe("42501");
  });

  it("erlaubt Uploads nur in den eigenen Storage-Ordner", async () => {
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const own = await bob.client.storage.from("sources").upload(`${bob.id}/${aliceNotebookId}/eigen.pdf`, pdf);
    const foreign = await bob.client.storage.from("sources").upload(`${alice.id}/${aliceNotebookId}/fremd.pdf`, pdf);
    const anonymous = await anonClient().storage.from("sources").upload(`${alice.id}/anon.pdf`, pdf);

    expect(own.error).toBeNull();
    expect(foreign.error).not.toBeNull();
    expect(anonymous.error).not.toBeNull();
  });

  it("lässt fremde Dateien weder auflisten noch herunterladen", async () => {
    const pdf = new Blob(["%PDF-1.4 geheim"], { type: "application/pdf" });
    const path = `${alice.id}/${aliceNotebookId}/geheim.pdf`;
    const { error } = await alice.client.storage.from("sources").upload(path, pdf);
    expect(error).toBeNull();

    const list = await bob.client.storage.from("sources").list(`${alice.id}/${aliceNotebookId}`);
    const download = await bob.client.storage.from("sources").download(path);
    expect(list.data ?? []).toEqual([]);
    expect(download.data).toBeNull();
  });

  it("liefert über match_chunks keine fremden Chunks", async () => {
    const { data, error } = await bob.client.rpc("match_chunks", {
      query_embedding: JSON.stringify(Array(1024).fill(0.1)),
      source_ids: [aliceSourceId],
      match_count: 5,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
