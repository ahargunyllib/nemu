import type { SchoolAi } from "@nemu/ai/school/runtime";

import type { DocumentFileStore } from "../../context";
import type { WorkspaceId } from "../../workspace-ids";
import type { CatalogRepository } from "./catalog-repository";
import { indexBpmnDocument, indexMarkdownDocument, pdfToMarkdown } from "./indexing";
import { bpmnProcessElements } from "./process-elements";
import type { DocumentRecord, DocumentRepository, NewKnowledgeChunkRecord } from "./repository";

/** What an admin can upload. "procedure" documents are created from recordings, not uploaded. */
export type DocumentFormat = "pdf" | "md" | "bpmn";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  bpmn: "application/xml; charset=utf-8",
};

export type DocumentDeps = {
  documents: DocumentRepository;
  files: DocumentFileStore;
  /** Stores a BPMN's tasks and end events for the WS-04 editor; left out where none is needed. */
  catalog?: Pick<CatalogRepository, "replaceProcessElements">;
  /** F3-11: suggests each element's symptoms on BPMN upload; without it they start empty. */
  symptoms?: Pick<SchoolAi, "suggestSymptoms">;
};

export type UploadDocumentInput = {
  workspaceId: WorkspaceId;
  title: string;
  version: string;
  isActive: boolean;
  file: File;
  /** WS-04: the allowed websites (ids) it applies to; empty for every site. */
  siteIds?: string[];
  /** WS-02: the package it belongs to, or none for the school's own knowledge. */
  packageId?: string | null;
  /** The uploader's user id. */
  createdBy?: string;
};

export function documentFormatOf(fileName: string): DocumentFormat | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  if (name.endsWith(".bpmn") || name.endsWith(".bpmn20.xml")) return "bpmn";
  return null;
}

// Performs the cheap format checks before indexing.
export function inspectDocumentFile(format: DocumentFormat, bytes: ArrayBuffer): string | null {
  if (bytes.byteLength === 0) return "The file is empty.";

  if (format === "pdf") {
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 5));
    return head === "%PDF-" ? null : "The file is not a valid PDF.";
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    if (format === "bpmn") {
      return /<([a-z0-9]+:)?definitions[\s>]/iu.test(text)
        ? null
        : "The file is not a BPMN 2.0 XML file.";
    }
    return text.trim() ? null : "The Markdown file has no content.";
  } catch {
    return format === "bpmn"
      ? "The BPMN file is not valid UTF-8 text."
      : "The Markdown file is not valid UTF-8 text.";
  }
}

export async function uploadDocument(
  { documents, files, catalog, symptoms }: DocumentDeps,
  {
    workspaceId,
    title,
    version,
    isActive,
    file,
    siteIds = [],
    packageId = null,
    createdBy,
  }: UploadDocumentInput,
): Promise<DocumentRecord> {
  const format = documentFormatOf(file.name);
  if (!format) {
    throw new Error(`Unsupported knowledge document file: ${file.name}`);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("Knowledge documents must be 10 MB or smaller.");
  }

  const id = crypto.randomUUID();
  const storageKey = `${id}.${format}`;
  const contentType = CONTENT_TYPES[format];
  const bytes = await file.arrayBuffer();

  let failureReason = inspectDocumentFile(format, bytes);
  let chunks: NewKnowledgeChunkRecord[] = [];
  if (!failureReason) {
    try {
      if (format === "bpmn") {
        chunks = await indexBpmnDocument(
          { id, title, version },
          new TextDecoder("utf-8").decode(bytes),
        );
      } else {
        const markdown =
          format === "pdf"
            ? await pdfToMarkdown(bytes)
            : new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
        chunks = indexMarkdownDocument({ id, title, version }, markdown);
      }
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "The document could not be indexed.";
    }
  }

  const validAttachment = !failureReason;
  if (validAttachment) {
    try {
      await files.put(storageKey, bytes, contentType);
    } catch (error) {
      console.error("Storing knowledge document file failed", error);
      failureReason = "The file could not be stored.";
    }
  }

  let document: DocumentRecord;
  try {
    document = await documents.insert({
      id,
      workspaceId,
      title,
      version,
      isActive: false,
      status: "failed",
      failureReason: failureReason ?? "The document is being indexed.",
      format,
      fileName: file.name,
      contentType,
      sizeBytes: bytes.byteLength,
      storageKey,
      siteIds,
      packageId,
      createdBy: createdBy ?? null,
      changedBy: createdBy ?? null,
    });
  } catch (error) {
    if (validAttachment && failureReason !== "The file could not be stored.") {
      try {
        await files.delete(storageKey);
      } catch (deleteError) {
        console.error("Cleaning up knowledge document file failed", deleteError);
      }
    }
    throw error;
  }
  if (failureReason) return document;

  try {
    const ready = await documents.replaceChunksAndSetReady(document.id, chunks, isActive);
    if (format === "bpmn" && catalog) {
      const xml = new TextDecoder("utf-8").decode(bytes);
      await catalog.replaceProcessElements(id, await bpmnProcessElements(id, xml, symptoms));
    }
    return ready;
  } catch (error) {
    console.error("Indexing knowledge document failed", error);
    try {
      await files.delete(storageKey);
    } catch (deleteError) {
      console.error("Cleaning up knowledge document file failed", deleteError);
    }
    return (
      (await documents.setFailed(document.id, "The document index could not be stored.")) ?? {
        ...document,
        isActive: false,
        status: "failed",
        failureReason: "The document index could not be stored.",
      }
    );
  }
}

export function setDocumentActive(
  { documents }: Pick<DocumentDeps, "documents">,
  workspaceId: string,
  id: string,
  isActive: boolean,
  changedBy?: string,
) {
  return documents.setActive(workspaceId, id, isActive, changedBy);
}

// Removes the row first so Nemu stops answering from the document even if the
// file cleanup fails; a leftover object in storage is unreachable without its row.
export async function deleteDocument(
  { documents, files }: DocumentDeps,
  workspaceId: string,
  id: string,
): Promise<DocumentRecord | undefined> {
  const document = await documents.delete(workspaceId, id);
  if (!document) return undefined;

  try {
    await files.delete(document.storageKey);
  } catch (error) {
    console.error("Deleting knowledge document file failed", error);
  }
  return document;
}

// How the Admin Workspace reads an uploaded file back. Nemu reads stored chunks instead.
export async function readDocumentFile(
  { documents, files }: DocumentDeps,
  workspaceId: string,
  id: string,
): Promise<{ document: DocumentRecord; body: ArrayBuffer } | undefined> {
  const document = await documents.findById(workspaceId, id);
  if (!document) return undefined;

  const body = await files.get(document.storageKey);
  return body ? { document, body } : undefined;
}
