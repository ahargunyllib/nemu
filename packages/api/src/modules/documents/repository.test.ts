import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import type { DocumentFileStore } from "../../context";
import { createMigratedDb } from "../../testing/d1";
import { indexMarkdownDocument } from "./indexing";
import { createDocumentRepository } from "./repository";
import { uploadDocument } from "./service";

const KNOWLEDGE_FILE = join(
  import.meta.dirname,
  "../../../../../data/01_knowledge_rag/asli/PMK-113-PMK.05-2012_teks.md",
);

async function createRepository() {
  return createDocumentRepository(await createMigratedDb());
}

function createFiles(): DocumentFileStore {
  const objects = new Map<string, ArrayBuffer>();
  return {
    async put(key, body) {
      objects.set(key, body);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

async function insertIndexingDocument(
  documents: Awaited<ReturnType<typeof createRepository>>,
  id: string,
) {
  return documents.insert({
    id,
    workspaceId: "W-TEST",
    title: "Panduan Klaim",
    version: "1.0",
    isActive: false,
    status: "failed",
    failureReason: "The document is being indexed.",
    format: "md",
    fileName: "panduan.md",
    contentType: "text/markdown; charset=utf-8",
    sizeBytes: 1,
    storageKey: `${id}.md`,
  });
}

function chunk(documentId: string, sequence: number, id = `${documentId}-${sequence}`) {
  return { id, documentId, sequence, text: `Bagian ${sequence}` };
}

describe("document repository on D1", () => {
  it("indexes an uploaded knowledge Markdown file into a ready document", async () => {
    const documents = await createRepository();
    const text = await readFile(KNOWLEDGE_FILE, "utf8");

    const document = await uploadDocument(
      { documents, files: createFiles() },
      {
        workspaceId: "W-TELKO",
        title: "PMK 113/2012",
        version: "2012",
        isActive: true,
        file: new File([text], "PMK-113.md"),
      },
    );

    expect(document).toMatchObject({ status: "ready", failureReason: null, isActive: true });
    const expected = indexMarkdownDocument(document, text);
    // More chunks than one insert statement can bind on D1.
    expect(expected.length).toBeGreaterThan(14);
    const stored = await documents.listActiveReadyChunks("W-TELKO");
    expect(
      stored.filter(({ documentId }) => documentId === document.id).map(({ id }) => id),
    ).toEqual(expected.map(({ id }) => id));
  });

  it("replaces a document's earlier chunks", async () => {
    const documents = await createRepository();
    await insertIndexingDocument(documents, "doc-1");
    await documents.replaceChunksAndSetReady("doc-1", [chunk("doc-1", 1), chunk("doc-1", 2)], true);

    await documents.replaceChunksAndSetReady("doc-1", [chunk("doc-1", 3)], true);

    const stored = await documents.listActiveReadyChunks("W-TEST");
    expect(stored.map(({ sequence }) => sequence)).toEqual([3]);
  });

  it("keeps the earlier chunks and status when replacing them fails", async () => {
    const documents = await createRepository();
    await insertIndexingDocument(documents, "doc-1");
    await documents.replaceChunksAndSetReady("doc-1", [chunk("doc-1", 1)], true);
    await documents.setActive("W-TEST", "doc-1", false);

    await expect(
      documents.replaceChunksAndSetReady(
        "doc-1",
        [chunk("doc-1", 2, "duplicate"), chunk("doc-1", 3, "duplicate")],
        true,
      ),
    ).rejects.toThrow();

    expect(await documents.findById("W-TEST", "doc-1")).toMatchObject({ isActive: false });
    await documents.setActive("W-TEST", "doc-1", true);
    const stored = await documents.listActiveReadyChunks("W-TEST");
    expect(stored.map(({ sequence }) => sequence)).toEqual([1]);
  });

  it("fails when the document disappeared while indexing", async () => {
    const documents = await createRepository();

    await expect(documents.replaceChunksAndSetReady("gone", [], true)).rejects.toThrow(
      "Knowledge document gone disappeared while indexing",
    );
    await expect(
      documents.replaceChunksAndSetReady("gone", [chunk("gone", 1)], true),
    ).rejects.toThrow();
    expect(await documents.listActiveReadyChunks("W-TEST")).toEqual([]);
  });
});
