import { chunkKnowledgeDocument } from "@nemu/ai/chunking";
import { extractText } from "unpdf";

import type { NewKnowledgeChunkRecord } from "./repository";

type IndexableDocument = { id: string; title: string; version: string };

function sectionOf(text: string): string | null {
  return text.match(/^#{1,6}\s+(.+)$/mu)?.[1]?.trim() ?? null;
}

export function indexMarkdownDocument(
  document: IndexableDocument,
  markdown: string,
): NewKnowledgeChunkRecord[] {
  const chunks = chunkKnowledgeDocument(
    {
      doc_id: document.id,
      judul: document.title,
      berlaku_untuk: document.version,
      status: "aktif",
    },
    markdown,
  );
  if (chunks.length === 0) {
    throw new Error("The Markdown file has no indexable content.");
  }

  return chunks.map((chunk, sequence) => ({
    id: chunk.id,
    documentId: document.id,
    article: chunk.article ?? null,
    section: sectionOf(chunk.text),
    page: chunk.page ?? null,
    sequence,
    text: chunk.text,
  }));
}

/**
 * Reads a PDF's text layer as Markdown, marking each page the way the knowledge sources do
 * (`[Halaman N]`) so chunks keep their page numbers. A scanned PDF has no text layer.
 */
export async function pdfToMarkdown(bytes: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(bytes.slice(0)), { mergePages: false });
  if (!text.some((page) => page.trim())) {
    throw new Error(
      "The PDF has no text layer. Scanned PDFs need OCR, which is not supported yet.",
    );
  }
  return text.map((page, index) => `[Halaman ${index + 1}]\n\n${page.trim()}`).join("\n\n");
}
