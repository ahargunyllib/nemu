import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { describe, expect, it, vi } from "vite-plus/test";

import type { DocumentFileStore } from "../../context";
import type { DocumentRecord, DocumentRepository, KnowledgeChunkRecord } from "./repository";
import {
  MAX_DOCUMENT_BYTES,
  type UploadDocumentInput,
  deleteDocument,
  listDocuments,
  readDocumentFile,
  setDocumentActive,
  uploadDocument,
} from "./service";

const KNOWLEDGE_DIR = join(import.meta.dirname, "../../../../../data/01_knowledge_rag");

function createFakes() {
  const rows: DocumentRecord[] = [];
  const chunks: KnowledgeChunkRecord[] = [];
  const objects = new Map<string, ArrayBuffer>();
  const documents: DocumentRepository = {
    async insert(record) {
      const now = new Date(Date.now() + rows.length);
      const row: DocumentRecord = {
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        ...record,
        workspaceId: record.workspaceId ?? "W-TRAVEL",
      };
      rows.push(row);
      return row;
    },
    async list(workspaceId) {
      return rows
        .filter((row) => row.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(workspaceId, id) {
      return rows.find((row) => row.workspaceId === workspaceId && row.id === id);
    },
    async setActive(workspaceId, id, isActive) {
      const row = rows.find(
        (candidate) => candidate.workspaceId === workspaceId && candidate.id === id,
      );
      if (row) row.isActive = isActive;
      return row;
    },
    async setFailed(id, failureReason) {
      const row = rows.find((candidate) => candidate.id === id);
      if (row) {
        row.status = "failed";
        row.failureReason = failureReason;
        row.isActive = false;
      }
      return row;
    },
    async replaceChunksAndSetReady(documentId, replacements, isActive) {
      chunks.splice(
        0,
        chunks.length,
        ...chunks.filter((chunk) => chunk.documentId !== documentId),
        ...replacements.map((replacement) => ({
          article: null,
          section: null,
          page: null,
          ...replacement,
        })),
      );
      const row = rows.find((candidate) => candidate.id === documentId);
      if (!row) throw new Error(`Missing document ${documentId}`);
      row.status = "ready";
      row.failureReason = null;
      row.isActive = isActive;
      return row;
    },
    async listActiveReadyChunks(workspaceId) {
      return chunks.flatMap((chunk) => {
        const document = rows.find(
          (candidate) =>
            candidate.id === chunk.documentId &&
            candidate.workspaceId === workspaceId &&
            candidate.isActive &&
            candidate.status === "ready",
        );
        return document
          ? [
              {
                ...chunk,
                documentTitle: document.title,
                documentVersion: document.version,
              },
            ]
          : [];
      });
    },
    async delete(workspaceId, id) {
      const index = rows.findIndex((row) => row.workspaceId === workspaceId && row.id === id);
      return index === -1 ? undefined : rows.splice(index, 1)[0];
    },
  };
  const files: DocumentFileStore = {
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
  return { deps: { documents, files }, objects, chunks };
}

function upload(file: File, overrides: Partial<UploadDocumentInput> = {}): UploadDocumentInput {
  return {
    workspaceId: "W-TRAVEL",
    title: "SOP Perjalanan Dinas",
    version: "1.0",
    isActive: true,
    file,
    ...overrides,
  };
}

describe("uploadDocument", () => {
  it("stores and indexes Markdown, then excludes all chunks after deactivation", async () => {
    const { deps, chunks } = createFakes();
    const file = new File(["# SOP\n\nIsi dokumen."], "sop.md");

    const document = await uploadDocument(deps, upload(file, { isActive: false }));

    expect(document).toMatchObject({
      title: "SOP Perjalanan Dinas",
      version: "1.0",
      isActive: false,
      status: "ready",
      failureReason: null,
      format: "md",
      fileName: "sop.md",
      sizeBytes: file.size,
    });
    const stored = await readDocumentFile(deps, "W-TRAVEL", document.id);
    expect(new TextDecoder().decode(stored?.body)).toBe("# SOP\n\nIsi dokumen.");
    expect(chunks).toEqual([
      expect.objectContaining({ documentId: document.id, text: "# SOP\n\nIsi dokumen." }),
    ]);
    expect(await deps.documents.listActiveReadyChunks("W-TRAVEL")).toHaveLength(0);

    await setDocumentActive(deps, "W-TRAVEL", document.id, true);
    expect(await deps.documents.listActiveReadyChunks("W-TRAVEL")).toEqual([
      expect.objectContaining({
        documentId: document.id,
        documentTitle: "SOP Perjalanan Dinas",
        documentVersion: "1.0",
      }),
    ]);

    await setDocumentActive(deps, "W-TRAVEL", document.id, false);
    expect(await deps.documents.listActiveReadyChunks("W-TRAVEL")).toHaveLength(0);
  });

  it("stores a valid PDF attachment while marking retrieval indexing unsupported", async () => {
    const { deps, objects } = createFakes();

    const document = await uploadDocument(
      deps,
      upload(new File(["%PDF-1.7\n..."], "PMK.pdf", { type: "application/pdf" })),
    );

    expect(document).toMatchObject({
      status: "failed",
      format: "pdf",
      failureReason: "PDF indexing is not supported yet.",
    });
    expect(objects.size).toBe(1);
    const stored = await readDocumentFile(deps, "W-TRAVEL", document.id);
    expect(new TextDecoder().decode(stored?.body)).toBe("%PDF-1.7\n...");
  });

  it("records a file that is not a real PDF as failed without storing it", async () => {
    const { deps, objects } = createFakes();

    const document = await uploadDocument(
      deps,
      upload(new File(["just text before %PDF-1.7"], "fake.pdf")),
    );

    expect(document.status).toBe("failed");
    expect(document.failureReason).toMatch(/not a valid PDF/);
    expect(objects.size).toBe(0);
    expect(await readDocumentFile(deps, "W-TRAVEL", document.id)).toBeUndefined();
  });

  it("records an empty file as failed", async () => {
    const { deps } = createFakes();

    const document = await uploadDocument(deps, upload(new File([], "empty.md")));

    expect(document).toMatchObject({ status: "failed", failureReason: "The file is empty." });
  });

  it("rejects an oversized upload before buffering it", async () => {
    const { deps } = createFakes();
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const file = {
      name: "too-large.md",
      size: MAX_DOCUMENT_BYTES + 1,
      arrayBuffer,
    } as unknown as File;

    await expect(uploadDocument(deps, upload(file))).rejects.toThrow("10 MB");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("records the document as failed when storing the file fails", async () => {
    const { deps } = createFakes();
    const failingFiles: DocumentFileStore = {
      ...deps.files,
      async put() {
        throw new Error("R2 unavailable");
      },
    };

    const document = await uploadDocument(
      { ...deps, files: failingFiles },
      upload(new File(["# SOP"], "sop.md")),
    );

    expect(document).toMatchObject({
      status: "failed",
      failureReason: "The file could not be stored.",
    });
  });

  it("cleans up the file and leaves no ready document when chunk storage fails", async () => {
    const { deps, objects } = createFakes();
    const failingDocuments: DocumentRepository = {
      ...deps.documents,
      async replaceChunksAndSetReady() {
        throw new Error("D1 unavailable");
      },
    };

    const document = await uploadDocument(
      { ...deps, documents: failingDocuments },
      upload(new File(["# SOP"], "sop.md")),
    );

    expect(document).toMatchObject({
      status: "failed",
      isActive: false,
      failureReason: "The document index could not be stored.",
    });
    expect(objects.size).toBe(0);
    expect(await failingDocuments.listActiveReadyChunks("W-TRAVEL")).toEqual([]);
  });

  it("uploads and lists every knowledge document in data/01_knowledge_rag", async () => {
    const { deps } = createFakes();
    const paths = (await readdir(KNOWLEDGE_DIR, { recursive: true }))
      .filter((path) => path.endsWith(".md"))
      .map((path) => join(KNOWLEDGE_DIR, path));
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      const file = new File([await readFile(path)], basename(path));
      await uploadDocument(deps, upload(file, { title: basename(path, ".md") }));
    }

    const listed = await listDocuments(deps, "W-TRAVEL");
    expect(listed).toHaveLength(paths.length);
    expect(listed.every((document) => document.status === "ready")).toBe(true);
  });
});

describe("setDocumentActive", () => {
  it("toggles a document's active status", async () => {
    const { deps } = createFakes();
    const document = await uploadDocument(deps, upload(new File(["# SOP"], "sop.md")));

    const deactivated = await setDocumentActive(deps, "W-TRAVEL", document.id, false);

    expect(deactivated?.isActive).toBe(false);
    expect((await listDocuments(deps, "W-TRAVEL"))[0]?.isActive).toBe(false);
  });
});

describe("workspace isolation", () => {
  it("lists only documents belonging to the authenticated workspace", async () => {
    const { deps } = createFakes();
    await uploadDocument(
      deps,
      upload(new File(["# Travel"], "travel.md"), { workspaceId: "W-TRAVEL" }),
    );
    await uploadDocument(
      deps,
      upload(new File(["# Telco"], "telco.md"), { workspaceId: "W-TELKO" }),
    );

    await expect(listDocuments(deps, "W-TRAVEL")).resolves.toEqual([
      expect.objectContaining({ workspaceId: "W-TRAVEL" }),
    ]);
  });
});

describe("deleteDocument", () => {
  it("removes the document and its stored file", async () => {
    const { deps, objects } = createFakes();
    const document = await uploadDocument(deps, upload(new File(["# SOP"], "sop.md")));

    const deleted = await deleteDocument(deps, "W-TRAVEL", document.id);

    expect(deleted?.id).toBe(document.id);
    expect(await listDocuments(deps, "W-TRAVEL")).toHaveLength(0);
    expect(objects.size).toBe(0);
    expect(await readDocumentFile(deps, "W-TRAVEL", document.id)).toBeUndefined();
  });

  it("removes the document even when deleting its file fails", async () => {
    const { deps } = createFakes();
    const document = await uploadDocument(deps, upload(new File(["# SOP"], "sop.md")));
    const failingFiles: DocumentFileStore = {
      ...deps.files,
      async delete() {
        throw new Error("R2 unavailable");
      },
    };

    await deleteDocument({ ...deps, files: failingFiles }, "W-TRAVEL", document.id);

    expect(await listDocuments(deps, "W-TRAVEL")).toHaveLength(0);
  });

  it("returns nothing for an unknown document", async () => {
    const { deps } = createFakes();

    expect(await deleteDocument(deps, "W-TRAVEL", "missing")).toBeUndefined();
  });
});
