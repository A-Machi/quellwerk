import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNotebook } from "@/backend/notebooks/service";
import {
  createPdfUpload,
  deleteSource,
  listSources,
  renameSource,
} from "@/backend/sources/service";
import { makePdf } from "@tests/helpers/pdf";
import { createTestUser, type TestUser } from "@tests/helpers/supabase";

// US-03 und US-06 gegen die echte Datenbank und den echten Storage
describe("Quellen", () => {
  let user: TestUser;
  let other: TestUser;
  let notebookId: string;

  beforeAll(async () => {
    user = await createTestUser("sources");
    other = await createTestUser("sources-other");
    notebookId = (await createNotebook(user.client, "Quellen-Test")).id;
  });

  afterAll(async () => {
    await user?.cleanup();
    await other?.cleanup();
  });

  async function uploadPdf(fileName: string, pages = ["Testinhalt für den Upload."]) {
    const pdf = await makePdf(pages);
    const ticket = await createPdfUpload(user.client, user.id, notebookId, {
      fileName,
      size: pdf.byteLength,
      type: "application/pdf",
    });
    const { error } = await user.client.storage
      .from("sources")
      .uploadToSignedUrl(ticket.path, ticket.token, new Blob([pdf as BlobPart], { type: "application/pdf" }));
    if (error) throw error;
    return ticket;
  }

  it("US-03: legt die Quelle an und erlaubt den Upload über die signierte URL", async () => {
    const ticket = await uploadPdf("Jahresbericht 2025.pdf");

    expect(ticket.path).toBe(`${user.id}/${notebookId}/${ticket.sourceId}.pdf`);
    const sources = await listSources(user.client, notebookId);
    expect(sources.find((s) => s.id === ticket.sourceId)).toMatchObject({
      title: "Jahresbericht 2025",
      type: "pdf",
      status: "uploaded",
      error: null,
      pageCount: null,
    });

    const { data: file } = await user.client.storage.from("sources").download(ticket.path);
    expect(new TextDecoder().decode(await file!.arrayBuffer()).startsWith("%PDF")).toBe(true);
  });

  it("US-03: lehnt Nicht-PDFs ab, bevor etwas angelegt wird", async () => {
    const before = (await listSources(user.client, notebookId)).length;
    await expect(
      createPdfUpload(user.client, user.id, notebookId, { fileName: "virus.exe", size: 100, type: "application/x-msdownload" }),
    ).rejects.toThrow("ist kein PDF");
    expect(await listSources(user.client, notebookId)).toHaveLength(before);
  });

  it("US-03: verhindert Uploads in fremde Notebooks", async () => {
    await expect(
      createPdfUpload(other.client, other.id, notebookId, { fileName: "a.pdf", size: 100, type: "application/pdf" }),
    ).rejects.toThrow("Notebook wurde nicht gefunden.");
  });

  it("US-03: der Storage lehnt Nicht-PDFs auch beim direkten Upload ab", async () => {
    const { error } = await user.client.storage
      .from("sources")
      .upload(`${user.id}/${notebookId}/skript.html`, new Blob(["<script>"], { type: "text/html" }));
    expect(error).not.toBeNull();
  });

  it("listet Quellen in der Reihenfolge des Hochladens", async () => {
    const a = await uploadPdf("A.pdf");
    const b = await uploadPdf("B.pdf");
    const ids = (await listSources(user.client, notebookId)).map((s) => s.id);
    expect(ids.indexOf(a.sourceId)).toBeLessThan(ids.indexOf(b.sourceId));
  });

  it("US-06: benennt eine Quelle um", async () => {
    const ticket = await uploadPdf("alt.pdf");
    await renameSource(user.client, ticket.sourceId, "  Neuer Name  ");
    const source = (await listSources(user.client, notebookId)).find((s) => s.id === ticket.sourceId);
    expect(source?.title).toBe("Neuer Name");
  });

  it("US-06: Löschen entfernt Datei, Quelle und Chunks", async () => {
    const ticket = await uploadPdf("weg.pdf");
    await user.client.from("chunks").insert({
      source_id: ticket.sourceId,
      chunk_index: 0,
      content: "x",
      token_count: 1,
      embedding: JSON.stringify(Array(1024).fill(0.02)),
    });

    await deleteSource(user.client, ticket.sourceId);

    expect((await listSources(user.client, notebookId)).some((s) => s.id === ticket.sourceId)).toBe(false);
    const chunks = await user.client.from("chunks").select("id").eq("source_id", ticket.sourceId);
    expect(chunks.data).toEqual([]);
    const { data: file } = await user.client.storage.from("sources").download(ticket.path);
    expect(file).toBeNull();
  });

  it("US-06: ein anderer Nutzer kann fremde Quellen weder umbenennen noch löschen", async () => {
    const ticket = await uploadPdf("geschützt.pdf");
    await expect(renameSource(other.client, ticket.sourceId, "Fremd")).rejects.toThrow("Quelle wurde nicht gefunden.");
    await expect(deleteSource(other.client, ticket.sourceId)).rejects.toThrow("Quelle wurde nicht gefunden.");
    expect((await listSources(user.client, notebookId)).some((s) => s.id === ticket.sourceId)).toBe(true);
  });
});
