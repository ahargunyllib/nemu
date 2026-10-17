import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import type { DocumentFileStore } from "../../context";
import type { DocumentRecord, DocumentRepository } from "./repository";
import {
  type UploadDocumentInput,
  listDocuments,
  readDocumentFile,
  setDocumentActive,
  uploadDocument,
} from "./service";

const KNOWLEDGE_DIR = join(import.meta.dirname, "../../../../../data/01_knowledge_rag");

function createFakes() {
  const rows: DocumentRecord[] = [];
  const objects = new Map<string, ArrayBuffer>();
  const documents: DocumentRepository = {
    async insert(record) {
      const now = new Date(Date.now() + rows.length);
      const row: DocumentRecord = {
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        ...record,
      };
      rows.push(row);
      return row;
    },
    async list() {
      return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(id) {
      return rows.find((row) => row.id === id);
    },
    async setActive(id, isActive) {
      const row = rows.find((candidate) => candidate.id === id);
      if (row) row.isActive = isActive;
      return row;
    },
  };
  const files: DocumentFileStore = {
    async put(key, body) {
      objects.set(key, body);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
  };
  return { deps: { documents, files }, objects };
}

function upload(file: File, overrides: Partial<UploadDocumentInput> = {}): UploadDocumentInput {
  return { title: "SOP Perjalanan Dinas", version: "1.0", isActive: true, file, ...overrides };
}

describe("uploadDocument", () => {
  it("stores a Markdown file and records it as ready with its metadata", async () => {
    const { deps } = createFakes();
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
    const stored = await readDocumentFile(deps, document.id);
    expect(new TextDecoder().decode(stored?.body)).toBe("# SOP\n\nIsi dokumen.");
  });

  it("stores a PDF that starts with a PDF header", async () => {
    const { deps } = createFakes();

    const document = await uploadDocument(
      deps,
      upload(new File(["%PDF-1.7\n..."], "PMK.pdf", { type: "application/pdf" })),
    );

    expect(document).toMatchObject({ status: "ready", format: "pdf" });
  });

  it("records a file that is not a real PDF as failed without storing it", async () => {
    const { deps, objects } = createFakes();

    const document = await uploadDocument(deps, upload(new File(["just text"], "fake.pdf")));

    expect(document.status).toBe("failed");
    expect(document.failureReason).toMatch(/not a valid PDF/);
    expect(objects.size).toBe(0);
    expect(await readDocumentFile(deps, document.id)).toBeUndefined();
  });

  it("records an empty file as failed", async () => {
    const { deps } = createFakes();

    const document = await uploadDocument(deps, upload(new File([], "empty.md")));

    expect(document).toMatchObject({ status: "failed", failureReason: "The file is empty." });
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

    const listed = await listDocuments(deps);
    expect(listed).toHaveLength(paths.length);
    expect(listed.every((document) => document.status === "ready")).toBe(true);
  });
});

describe("setDocumentActive", () => {
  it("toggles a document's active status", async () => {
    const { deps } = createFakes();
    const document = await uploadDocument(deps, upload(new File(["# SOP"], "sop.md")));

    const deactivated = await setDocumentActive(deps, document.id, false);

    expect(deactivated?.isActive).toBe(false);
    expect((await listDocuments(deps))[0]?.isActive).toBe(false);
  });
});
