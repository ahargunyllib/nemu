import type { DocumentFileStore } from "../../context";
import type { WorkspaceId } from "../../workspace-ids";
import { indexMarkdownDocument } from "./indexing";
import type { DocumentRecord, DocumentRepository, NewKnowledgeChunkRecord } from "./repository";

export type DocumentFormat = "pdf" | "md";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
};

export type DocumentDeps = {
  documents: DocumentRepository;
  files: DocumentFileStore;
};

export type UploadDocumentInput = {
  workspaceId: WorkspaceId;
  title: string;
  version: string;
  isActive: boolean;
  file: File;
};

export function documentFormatOf(fileName: string): DocumentFormat | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  return null;
}

// Performs the cheap format checks before Markdown indexing. PDF validity is checked here too,
// but PDF indexing stays explicitly unsupported rather than exposing an unindexed ready document.
export function inspectDocumentFile(format: DocumentFormat, bytes: ArrayBuffer): string | null {
  if (bytes.byteLength === 0) return "The file is empty.";

  if (format === "pdf") {
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 5));
    return head === "%PDF-" ? null : "The file is not a valid PDF.";
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return text.trim() ? null : "The Markdown file has no content.";
  } catch {
    return "The Markdown file is not valid UTF-8 text.";
  }
}

export async function uploadDocument(
  { documents, files }: DocumentDeps,
  { workspaceId, title, version, isActive, file }: UploadDocumentInput,
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
  if (!failureReason && format === "md") {
    try {
      chunks = indexMarkdownDocument(
        { id, title, version },
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes),
      );
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

  if (!failureReason && format === "pdf") {
    failureReason = "PDF indexing is not supported yet.";
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
    return await documents.replaceChunksAndSetReady(document.id, chunks, isActive);
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

export function listDocuments({ documents }: Pick<DocumentDeps, "documents">, workspaceId: string) {
  return documents.list(workspaceId);
}

export function setDocumentActive(
  { documents }: Pick<DocumentDeps, "documents">,
  workspaceId: string,
  id: string,
  isActive: boolean,
) {
  return documents.setActive(workspaceId, id, isActive);
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
