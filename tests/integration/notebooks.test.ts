import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserFacingError } from "@/backend/errors";
import {
  createNotebook,
  DEFAULT_NOTEBOOK_TITLE,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameNotebook,
} from "@/backend/notebooks/service";
import { createTestUser, type TestUser } from "@tests/helpers/supabase";

// US-01 und US-02 gegen die echte Datenbank
describe("Notebooks", () => {
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    user = await createTestUser("notebooks");
    other = await createTestUser("notebooks-other");
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  it("US-01: legt ein Notebook mit Standardtitel an", async () => {
    const notebook = await createNotebook(user.client);
    expect(notebook.title).toBe(DEFAULT_NOTEBOOK_TITLE);
    expect(await getNotebook(user.client, notebook.id)).toEqual(notebook);
  });

  it("US-02: listet Notebooks mit Anzahl der Quellen, zuletzt geänderte zuerst", async () => {
    const first = await createNotebook(user.client, "Erstes");
    const second = await createNotebook(user.client, "Zweites");
    await user.client.from("sources").insert([
      { notebook_id: first.id, type: "pdf", title: "A", storage_path: `${user.id}/${first.id}/a.pdf` },
      { notebook_id: first.id, type: "pdf", title: "B", storage_path: `${user.id}/${first.id}/b.pdf` },
    ]);
    // Umbenennen setzt updated_at neu, "Erstes" rutscht nach oben.
    await renameNotebook(user.client, first.id, "Erstes (umbenannt)");

    const list = await listNotebooks(user.client);
    const ids = list.map((n) => n.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
    expect(list.find((n) => n.id === first.id)).toMatchObject({ title: "Erstes (umbenannt)", sourceCount: 2 });
    expect(list.find((n) => n.id === second.id)?.sourceCount).toBe(0);
  });

  it("US-02: zeigt einem anderen Nutzer keine fremden Notebooks", async () => {
    await createNotebook(user.client, "Privat");
    const list = await listNotebooks(other.client);
    expect(list.some((n) => n.title === "Privat")).toBe(false);
  });

  it("lehnt ungültige Titel ab", async () => {
    const notebook = await createNotebook(user.client);
    await expect(renameNotebook(user.client, notebook.id, "   ")).rejects.toThrow("Der Titel darf nicht leer sein.");
  });

  it("meldet 'nicht gefunden', wenn jemand ein fremdes Notebook umbenennen oder löschen will", async () => {
    const notebook = await createNotebook(user.client, "Meins");
    await expect(renameNotebook(other.client, notebook.id, "Fremd")).rejects.toThrow(UserFacingError);
    await expect(deleteNotebook(other.client, notebook.id)).rejects.toThrow("Notebook wurde nicht gefunden.");
    expect((await getNotebook(user.client, notebook.id))?.title).toBe("Meins");
  });

  it("US-02: Löschen entfernt Quellen, Chunks, Nachrichten und Dateien mit", async () => {
    const notebook = await createNotebook(user.client, "Wird gelöscht");
    const path = `${user.id}/${notebook.id}/datei.pdf`;
    await user.client.storage.from("sources").upload(path, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
    const { data: source } = await user.client
      .from("sources")
      .insert({ notebook_id: notebook.id, type: "pdf", title: "Datei", storage_path: path })
      .select("id")
      .single();
    await user.client.from("chunks").insert({
      source_id: source!.id,
      chunk_index: 0,
      content: "Text",
      token_count: 1,
      embedding: JSON.stringify(Array(1024).fill(0.01)),
    });
    await user.client.from("messages").insert({ notebook_id: notebook.id, role: "user", content: "Hallo" });

    await deleteNotebook(user.client, notebook.id);

    expect(await getNotebook(user.client, notebook.id)).toBeNull();
    const sources = await user.client.from("sources").select("id").eq("notebook_id", notebook.id);
    const chunks = await user.client.from("chunks").select("id").eq("source_id", source!.id);
    const messages = await user.client.from("messages").select("id").eq("notebook_id", notebook.id);
    const files = await user.client.storage.from("sources").list(`${user.id}/${notebook.id}`);
    expect(sources.data).toEqual([]);
    expect(chunks.data).toEqual([]);
    expect(messages.data).toEqual([]);
    expect(files.data).toEqual([]);
  });

  it("liefert für ungültige oder unbekannte IDs null statt eines Fehlers", async () => {
    expect(await getNotebook(user.client, "kein-uuid")).toBeNull();
    expect(await getNotebook(user.client, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
