import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import type { SchoolAi } from "@nemu/ai/school/runtime";

import type { DocumentFileStore } from "../../context";
import type { WorkspaceId } from "../../workspace-ids";
import type { CatalogDocument, CatalogRepository, DocumentListScope } from "./catalog-repository";
import type { DocumentLinkSigner } from "./file-link";
import { indexBpmnDocument, indexMarkdownDocument, pdfToMarkdown } from "./indexing";
import { bpmnProcessElements } from "./process-elements";
import { describeProcessElements, type ProcessDetail, summarizeProcess } from "./process-summary";
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

/** A listed document, and whether this user may only read it (a package document for an operator). */
export type KnowledgeDocument = CatalogDocument & { readOnly: boolean };

/**
 * WS-04 lists the school's own documents and, with `all`, the built-in package's next to them
 * (Dokumen dan alur): an operator sees what Nemu answers from but can't change a package document.
 */
export async function listKnowledge(
  { catalog }: { catalog: Pick<CatalogRepository, "listDocuments"> },
  workspaceId: string,
  scope: DocumentListScope,
  canManagePackages: boolean,
): Promise<KnowledgeDocument[]> {
  const documents = await catalog.listDocuments(workspaceId, scope);
  return documents.map((document) => ({
    ...document,
    readOnly: document.packageId !== null && !canManagePackages,
  }));
}

/**
 * Whether this user may switch, re-site, version or delete the document: a package document only
 * when they manage packages. A document that isn't there passes, so the caller reports NOT_FOUND.
 */
export async function canEditDocument(
  { documents }: { documents: Pick<DocumentRepository, "findById"> },
  workspaceId: string,
  id: string,
  canManagePackages: boolean,
): Promise<boolean> {
  if (canManagePackages) return true;
  const document = await documents.findById(workspaceId, id);
  return !document?.packageId;
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

/** How long a Sumber link opens its document: long enough to click, short enough not to share. */
export const DOCUMENT_LINK_TTL_MS = 10 * 60 * 1000;

/**
 * Sumber (#258): a link to a PDF the caller's school reads, for a tab that carries no Nemu headers
 * or session; the browser's viewer opens it at the cited page. Undefined when the school doesn't
 * read that document, or it isn't a PDF.
 */
export async function createDocumentFileLink(
  { documents, links }: { documents: DocumentRepository; links: DocumentLinkSigner },
  workspaceId: string,
  id: string,
): Promise<{ path: string; expiresAt: number } | undefined> {
  const document = await documents.findReadable(workspaceId, id);
  if (document?.format !== "pdf") return undefined;

  const expiresAt = links.now() + DOCUMENT_LINK_TTL_MS;
  const token = await links.sign({ workspaceId, documentId: document.id, expiresAt });
  const path = `/api-reference/documents/${encodeURIComponent(document.id)}/file?token=${token}`;
  return { path, expiresAt };
}

export type SignedDocumentFile =
  | { status: "ok"; document: DocumentRecord; body: ArrayBuffer }
  | { status: "invalid" | "expired" | "not_found" };

/**
 * Opens a Sumber link: the token must be signed for this document and unexpired, and the school
 * must still read the document, so switching it off in WS-04 closes links already handed out.
 */
export async function openSignedDocumentFile(
  {
    documents,
    files,
    links,
  }: { documents: DocumentRepository; files: DocumentFileStore; links: DocumentLinkSigner },
  id: string,
  token: string,
): Promise<SignedDocumentFile> {
  const claims = await links.verify(token);
  if (claims === "invalid" || claims === "expired") return { status: claims };
  if (claims.documentId !== id) return { status: "invalid" };

  const document = await documents.findReadable(claims.workspaceId, id);
  if (!document) return { status: "not_found" };
  const body = await files.get(document.storageKey);
  return body ? { status: "ok", document, body } : { status: "not_found" };
}

/** Dokumen dan alur's stat cards (WS-04): what Nemu answers from today, school and package. */
export type KnowledgeStats = {
  active: { total: number; package: number; school: number };
  processes: { count: number; tasks: number; unmappedTasks: number };
  /** `latestSteps` is the newest active recording's step count, null without one. */
  recordings: { count: number; latestSteps: number | null };
};

export async function knowledgeStats(
  {
    documents,
    files,
    catalog,
  }: {
    documents: Pick<DocumentRepository, "list">;
    files: DocumentFileStore;
    catalog: Pick<CatalogRepository, "listProcessElements">;
  },
  workspaceId: string,
): Promise<KnowledgeStats> {
  const active = (await documents.list(workspaceId)).filter(
    (document) => document.isActive && document.status === "ready",
  );
  const processes = active.filter((document) => document.format === "bpmn");
  const recordings = active.filter((document) => document.format === "procedure");

  const summaries = await Promise.all(
    processes.map(async (document) => {
      const [body, elements] = await Promise.all([
        files.get(document.storageKey),
        catalog.listProcessElements(workspaceId, document.id),
      ]);
      if (!body) return null;
      try {
        return summarizeProcess(await importBpmn(new TextDecoder().decode(body)), elements);
      } catch (error) {
        console.error("Reading a BPMN for the knowledge stats failed", error);
        return null;
      }
    }),
  );

  // `list` is newest first.
  const latest = recordings[0];
  const latestBody = latest ? await files.get(latest.storageKey) : null;

  return {
    active: {
      total: active.length,
      package: active.filter((document) => document.packageId !== null).length,
      school: active.filter((document) => document.packageId === null).length,
    },
    processes: {
      count: processes.length,
      tasks: summaries.reduce((sum, summary) => sum + (summary?.taskCount ?? 0), 0),
      unmappedTasks: summaries.reduce((sum, summary) => sum + (summary?.unmappedTasks ?? 0), 0),
    },
    recordings: {
      count: recordings.length,
      latestSteps: latestBody ? procedureStepCount(latestBody) : null,
    },
  };
}

function procedureStepCount(body: ArrayBuffer): number | null {
  try {
    const steps = (JSON.parse(new TextDecoder().decode(body)) as { steps?: unknown }).steps;
    return Array.isArray(steps) ? steps.length : null;
  } catch {
    return null;
  }
}

/**
 * The knowledge panel for one BPMN (WS-04, F3-19): its task and gateway counts and every stored
 * element with its performer, lane, branch and BPMN link. Undefined for a document that isn't a
 * ready BPMN of this workspace or whose file is gone.
 */
export async function describeProcess(
  {
    documents,
    files,
    catalog,
  }: {
    documents: Pick<DocumentRepository, "findById">;
    files: DocumentFileStore;
    catalog: Pick<CatalogRepository, "listProcessElements">;
  },
  workspaceId: string,
  id: string,
): Promise<ProcessDetail | undefined> {
  const document = await documents.findById(workspaceId, id);
  if (document?.format !== "bpmn" || document.status !== "ready") return undefined;
  const [body, elements] = await Promise.all([
    files.get(document.storageKey),
    catalog.listProcessElements(workspaceId, id),
  ]);
  if (!body) return undefined;
  return describeProcessElements(await importBpmn(new TextDecoder().decode(body)), elements);
}
