import type { KnowledgeChunk } from "@nemu/ai";

import type { ActiveKnowledgeChunkRecord } from "./repository";

/** Shapes stored active chunks the way the Nemu pipeline cites them. */
export function toKnowledgeChunks(chunks: readonly ActiveKnowledgeChunkRecord[]): KnowledgeChunk[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    docId: chunk.documentId,
    title: chunk.documentTitle,
    version: chunk.documentVersion,
    ...((chunk.article ?? chunk.section)
      ? { article: chunk.article ?? chunk.section ?? undefined }
      : {}),
    ...(chunk.page === null ? {} : { page: chunk.page }),
    active: true,
    text: chunk.text,
  }));
}
