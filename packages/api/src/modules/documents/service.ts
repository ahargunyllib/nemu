import type { DocumentFileStore } from "../../context";
import type { DocumentRecord, DocumentRepository } from "./repository";

export type DocumentFormat = "pdf" | "md";

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
};

export type DocumentDeps = {
  documents: DocumentRepository;
  files: DocumentFileStore;
};

export type UploadDocumentInput = {
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

// Stands in for indexing until the AI team's workspace loader exists: a document is
// ready when its file is a readable PDF or Markdown, and failed (with a reason) otherwise.
export function inspectDocumentFile(format: DocumentFormat, bytes: ArrayBuffer): string | null {
  if (bytes.byteLength === 0) return "The file is empty.";

  if (format === "pdf") {
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
    return head.includes("%PDF-") ? null : "The file is not a valid PDF.";
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
  { title, version, isActive, file }: UploadDocumentInput,
): Promise<DocumentRecord> {
  const format = documentFormatOf(file.name);
  if (!format) {
    throw new Error(`Unsupported knowledge document file: ${file.name}`);
  }

  const id = crypto.randomUUID();
  const storageKey = `${id}.${format}`;
  const contentType = CONTENT_TYPES[format];
  const bytes = await file.arrayBuffer();

  let failureReason = inspectDocumentFile(format, bytes);
  if (!failureReason) {
    try {
      await files.put(storageKey, bytes, contentType);
    } catch (error) {
      console.error("Storing knowledge document file failed", error);
      failureReason = "The file could not be stored.";
    }
  }

  return documents.insert({
    id,
    title,
    version,
    isActive,
    status: failureReason ? "failed" : "ready",
    failureReason,
    format,
    fileName: file.name,
    contentType,
    sizeBytes: bytes.byteLength,
    storageKey,
  });
}

export function listDocuments({ documents }: Pick<DocumentDeps, "documents">) {
  return documents.list();
}

export function setDocumentActive(
  { documents }: Pick<DocumentDeps, "documents">,
  id: string,
  isActive: boolean,
) {
  return documents.setActive(id, isActive);
}

// How the server reads an uploaded file back, e.g. for a future AI workspace loader.
export async function readDocumentFile(
  { documents, files }: DocumentDeps,
  id: string,
): Promise<{ document: DocumentRecord; body: ArrayBuffer } | undefined> {
  const document = await documents.findById(id);
  if (!document || document.status !== "ready") return undefined;

  const body = await files.get(document.storageKey);
  return body ? { document, body } : undefined;
}
