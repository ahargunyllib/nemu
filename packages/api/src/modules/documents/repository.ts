import { and, type Database, desc, eq, getColumns } from "@nemu/db";
import { knowledgeChunk, knowledgeDocument } from "@nemu/db/schema/documents";

export type DocumentRecord = typeof knowledgeDocument.$inferSelect;
export type NewDocumentRecord = typeof knowledgeDocument.$inferInsert;
export type KnowledgeChunkRecord = typeof knowledgeChunk.$inferSelect;
export type NewKnowledgeChunkRecord = typeof knowledgeChunk.$inferInsert;
export type ActiveKnowledgeChunkRecord = KnowledgeChunkRecord & {
  documentTitle: string;
  documentVersion: string;
};

export type DocumentRepository = {
  insert(record: NewDocumentRecord): Promise<DocumentRecord>;
  list(workspaceId: string): Promise<DocumentRecord[]>;
  findById(workspaceId: string, id: string): Promise<DocumentRecord | undefined>;
  setActive(
    workspaceId: string,
    id: string,
    isActive: boolean,
  ): Promise<DocumentRecord | undefined>;
  setFailed(id: string, failureReason: string): Promise<DocumentRecord | undefined>;
  replaceChunksAndSetReady(
    documentId: string,
    chunks: NewKnowledgeChunkRecord[],
    isActive: boolean,
  ): Promise<DocumentRecord>;
  listActiveReadyChunks(workspaceId?: string): Promise<ActiveKnowledgeChunkRecord[]>;
  delete(workspaceId: string, id: string): Promise<DocumentRecord | undefined>;
};

// D1 binds at most 100 parameters per statement, and a chunk row binds one per column.
const CHUNK_ROWS_PER_INSERT = Math.floor(100 / Object.keys(getColumns(knowledgeChunk)).length);

export function createDocumentRepository(db: Database): DocumentRepository {
  return {
    async insert(record) {
      const [inserted] = await db.insert(knowledgeDocument).values(record).returning();
      if (!inserted) {
        throw new Error(`Inserting knowledge document ${record.id} returned no row`);
      }
      return inserted;
    },
    list(workspaceId) {
      return db
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.workspaceId, workspaceId))
        .orderBy(desc(knowledgeDocument.createdAt));
    },
    async findById(workspaceId, id) {
      const [found] = await db
        .select()
        .from(knowledgeDocument)
        .where(and(eq(knowledgeDocument.workspaceId, workspaceId), eq(knowledgeDocument.id, id)))
        .limit(1);
      return found;
    },
    async setActive(workspaceId, id, isActive) {
      const [updated] = await db
        .update(knowledgeDocument)
        .set({ isActive })
        .where(
          and(
            eq(knowledgeDocument.workspaceId, workspaceId),
            eq(knowledgeDocument.id, id),
            eq(knowledgeDocument.status, "ready"),
          ),
        )
        .returning();
      return updated;
    },
    async setFailed(id, failureReason) {
      const [updated] = await db
        .update(knowledgeDocument)
        .set({ status: "failed", failureReason, isActive: false })
        .where(eq(knowledgeDocument.id, id))
        .returning();
      return updated;
    },
    // D1 rejects BEGIN, so `db.transaction` can't run there; a batch is D1's atomic write.
    async replaceChunksAndSetReady(documentId, chunks, isActive) {
      const insertChunks = [];
      for (let start = 0; start < chunks.length; start += CHUNK_ROWS_PER_INSERT) {
        insertChunks.push(
          db.insert(knowledgeChunk).values(chunks.slice(start, start + CHUNK_ROWS_PER_INSERT)),
        );
      }
      const [[updated]] = await db.batch([
        db
          .update(knowledgeDocument)
          .set({ status: "ready", failureReason: null, isActive })
          .where(eq(knowledgeDocument.id, documentId))
          .returning(),
        db.delete(knowledgeChunk).where(eq(knowledgeChunk.documentId, documentId)),
        ...insertChunks,
      ]);
      if (!updated) {
        throw new Error(`Knowledge document ${documentId} disappeared while indexing`);
      }
      return updated;
    },
    listActiveReadyChunks(workspaceId = "W-TRAVEL") {
      return db
        .select({
          ...getColumns(knowledgeChunk),
          documentTitle: knowledgeDocument.title,
          documentVersion: knowledgeDocument.version,
        })
        .from(knowledgeChunk)
        .innerJoin(knowledgeDocument, eq(knowledgeDocument.id, knowledgeChunk.documentId))
        .where(
          and(
            eq(knowledgeDocument.workspaceId, workspaceId),
            eq(knowledgeDocument.isActive, true),
            eq(knowledgeDocument.status, "ready"),
          ),
        )
        .orderBy(knowledgeChunk.documentId, knowledgeChunk.sequence);
    },
    async delete(workspaceId, id) {
      const [deleted] = await db
        .delete(knowledgeDocument)
        .where(and(eq(knowledgeDocument.workspaceId, workspaceId), eq(knowledgeDocument.id, id)))
        .returning();
      return deleted;
    },
  };
}
