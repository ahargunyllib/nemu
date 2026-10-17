import { type Database, desc, eq } from "@nemu/db";
import { knowledgeDocument } from "@nemu/db/schema/documents";

export type DocumentRecord = typeof knowledgeDocument.$inferSelect;
export type NewDocumentRecord = typeof knowledgeDocument.$inferInsert;

export type DocumentRepository = {
  insert(record: NewDocumentRecord): Promise<DocumentRecord>;
  list(): Promise<DocumentRecord[]>;
  findById(id: string): Promise<DocumentRecord | undefined>;
  setActive(id: string, isActive: boolean): Promise<DocumentRecord | undefined>;
  delete(id: string): Promise<DocumentRecord | undefined>;
};

export function createDocumentRepository(db: Database): DocumentRepository {
  return {
    async insert(record) {
      const [inserted] = await db.insert(knowledgeDocument).values(record).returning();
      if (!inserted) {
        throw new Error(`Inserting knowledge document ${record.id} returned no row`);
      }
      return inserted;
    },
    list() {
      return db.select().from(knowledgeDocument).orderBy(desc(knowledgeDocument.createdAt));
    },
    async findById(id) {
      const [found] = await db
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.id, id))
        .limit(1);
      return found;
    },
    async setActive(id, isActive) {
      const [updated] = await db
        .update(knowledgeDocument)
        .set({ isActive })
        .where(eq(knowledgeDocument.id, id))
        .returning();
      return updated;
    },
    async delete(id) {
      const [deleted] = await db
        .delete(knowledgeDocument)
        .where(eq(knowledgeDocument.id, id))
        .returning();
      return deleted;
    },
  };
}
