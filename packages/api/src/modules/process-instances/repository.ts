import { type Database, and, desc, eq, inArray, like } from "@nemu/db";
import { processDocument, processInstance } from "@nemu/db/schema/process-instances";

export type ProcessInstanceRecord = typeof processInstance.$inferSelect;
export type NewProcessInstanceRecord = typeof processInstance.$inferInsert;
export type ProcessDocumentRecord = typeof processDocument.$inferSelect;
export type NewProcessDocumentRecord = typeof processDocument.$inferInsert;

export type ProcessInstanceRepository = {
  insert(record: NewProcessInstanceRecord): Promise<ProcessInstanceRecord>;
  listByOwner(ownerId: string): Promise<ProcessInstanceRecord[]>;
  findOwned(ownerId: string, id: string): Promise<ProcessInstanceRecord | undefined>;
  updateState(id: string, state: ProcessInstanceRecord["state"]): Promise<ProcessInstanceRecord>;
  /** The highest id starting with `prefix`, e.g. the last PD-2026-NNNN. */
  lastIdWithPrefix(prefix: string): Promise<string | undefined>;
  listDocuments(instanceIds: readonly string[]): Promise<ProcessDocumentRecord[]>;
  /** Stores an upload, replacing an earlier one of the same kind. */
  saveDocument(record: NewProcessDocumentRecord): Promise<ProcessDocumentRecord>;
  /** Deletes the owner's instances (and their documents) and inserts these instead. */
  replaceOwned(
    ownerId: string,
    instances: readonly NewProcessInstanceRecord[],
    documents: readonly NewProcessDocumentRecord[],
  ): Promise<void>;
};

export function createProcessInstanceRepository(db: Database): ProcessInstanceRepository {
  return {
    async insert(record) {
      const [inserted] = await db.insert(processInstance).values(record).returning();
      if (!inserted) {
        throw new Error(`Inserting process instance ${record.id} returned no row`);
      }
      return inserted;
    },
    listByOwner(ownerId) {
      return db
        .select()
        .from(processInstance)
        .where(eq(processInstance.ownerId, ownerId))
        .orderBy(desc(processInstance.createdAt));
    },
    async findOwned(ownerId, id) {
      const [found] = await db
        .select()
        .from(processInstance)
        .where(and(eq(processInstance.id, id), eq(processInstance.ownerId, ownerId)));
      return found;
    },
    async updateState(id, state) {
      const [updated] = await db
        .update(processInstance)
        .set({ state })
        .where(eq(processInstance.id, id))
        .returning();
      if (!updated) throw new Error(`Updating process instance ${id} returned no row`);
      return updated;
    },
    async lastIdWithPrefix(prefix) {
      const [last] = await db
        .select({ id: processInstance.id })
        .from(processInstance)
        .where(like(processInstance.id, `${prefix}%`))
        .orderBy(desc(processInstance.id))
        .limit(1);
      return last?.id;
    },
    async listDocuments(instanceIds) {
      if (instanceIds.length === 0) return [];
      return db
        .select()
        .from(processDocument)
        .where(inArray(processDocument.instanceId, [...instanceIds]));
    },
    async saveDocument(record) {
      const [saved] = await db
        .insert(processDocument)
        .values(record)
        .onConflictDoUpdate({
          target: [processDocument.instanceId, processDocument.jenis],
          set: { namaFile: record.namaFile, uploadedAt: new Date() },
        })
        .returning();
      if (!saved)
        throw new Error(`Saving ${record.jenis} for ${record.instanceId} returned no row`);
      return saved;
    },
    async replaceOwned(ownerId, instances, documents) {
      await db.delete(processInstance).where(eq(processInstance.ownerId, ownerId));
      if (instances.length) await db.insert(processInstance).values([...instances]);
      if (documents.length) await db.insert(processDocument).values([...documents]);
    },
  };
}
