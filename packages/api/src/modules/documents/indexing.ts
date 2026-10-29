import { chunkKnowledgeDocument } from "@nemu/ai/chunking";

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
