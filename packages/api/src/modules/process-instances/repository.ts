import { type Database, desc, eq, like } from "@nemu/db";
import { processInstance } from "@nemu/db/schema/process-instances";

export type ProcessInstanceRecord = typeof processInstance.$inferSelect;
export type NewProcessInstanceRecord = typeof processInstance.$inferInsert;

export type ProcessInstanceRepository = {
  insert(record: NewProcessInstanceRecord): Promise<ProcessInstanceRecord>;
  listByOwner(ownerId: string): Promise<ProcessInstanceRecord[]>;
  /** The highest id starting with `prefix`, e.g. the last PD-2026-NNNN. */
  lastIdWithPrefix(prefix: string): Promise<string | undefined>;
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
    async lastIdWithPrefix(prefix) {
      const [last] = await db
        .select({ id: processInstance.id })
        .from(processInstance)
        .where(like(processInstance.id, `${prefix}%`))
        .orderBy(desc(processInstance.id))
        .limit(1);
      return last?.id;
    },
  };
}
