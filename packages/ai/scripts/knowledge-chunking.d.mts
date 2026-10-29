export type ChunkingDocument = {
  doc_id: string;
  judul: string;
  berlaku_untuk?: string;
  berlaku_mulai?: string;
  status: string;
};

export type SourceKnowledgeChunk = {
  id: string;
  docId: string;
  title: string;
  version: string;
  article?: string;
  page?: number;
  active: boolean;
  text: string;
};

export function chunkKnowledgeDocument(
  document: ChunkingDocument,
  markdown: string,
): SourceKnowledgeChunk[];
