import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { createDb } from "@nemu/db";
import { describe, expect, it } from "vite-plus/test";

import type { DocumentFileStore } from "../../context";
import { indexMarkdownDocument } from "./indexing";
import { createDocumentRepository } from "./repository";
import { uploadDocument } from "./service";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../../db/src/migrations");
const KNOWLEDGE_FILE = join(
  import.meta.dirname,
  "../../../../../data/01_knowledge_rag/asli/PMK-113-PMK.05-2012_teks.md",
);

// A D1 binding over in-memory SQLite that keeps the D1 rules drizzle has to live with:
// no BEGIN or SAVEPOINT, at most 100 bound parameters, and `batch` as the atomic write.
function createD1(sqlite: DatabaseSync) {
  function statement(query: string, params: SQLInputValue[] = []) {
    function execute() {
      if (/^\s*(begin|savepoint|commit|rollback|release)\b/i.test(query)) {
        throw new Error("D1_ERROR: use batch() instead of BEGIN TRANSACTION or SAVEPOINT");
      }
      if (params.length > 100) throw new Error("D1_ERROR: too many SQL variables");
      return sqlite.prepare(query).all(...params);
    }
    return {
      bind: (...values: SQLInputValue[]) => statement(query, values),
      execute,
      all: async () => ({ success: true, meta: {}, results: execute() }),
      run: async () => ({ success: true, meta: {}, results: execute() }),
      first: async () => execute()[0] ?? null,
      raw: async () => execute().map((row) => Object.values(row)),
    };
  }
  const d1 = {
    prepare: (query: string) => statement(query),
    async batch(statements: ReturnType<typeof statement>[]) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((stmt) => ({
          success: true,
          meta: {},
          results: stmt.execute(),
        }));
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // The fake covers the part of D1Database that drizzle's D1 driver calls.
  return d1 as unknown as D1Database;
}

async function createRepository() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of (await readdir(MIGRATIONS_DIR)).sort()) {
    sqlite.exec(await readFile(join(MIGRATIONS_DIR, migration, "migration.sql"), "utf8"));
  }
  return createDocumentRepository(createDb({ DB: createD1(sqlite) }));
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
