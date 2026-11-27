import { and, asc, type Database, eq } from "@nemu/db";
import { kamusKendala } from "@nemu/db/schema/kamus";

export type KamusRecord = typeof kamusKendala.$inferSelect;
export type KamusEntry = Omit<KamusRecord, "id" | "workspaceId" | "createdAt" | "updatedAt">;
export type KamusFixer = KamusRecord["fixer"];

/** WS-05 storage: one row per error message the school knows. */
export type KamusRepository = {
  list(workspaceId: string): Promise<KamusRecord[]>;
  insert(workspaceId: string, entry: KamusEntry): Promise<void>;
  update(workspaceId: string, id: string, entry: KamusEntry): Promise<boolean>;
  delete(workspaceId: string, id: string): Promise<boolean>;
};

export function createKamusRepository(db: Database): KamusRepository {
  return {
    list(workspaceId) {
      return db
        .select()
        .from(kamusKendala)
        .where(eq(kamusKendala.workspaceId, workspaceId))
        .orderBy(asc(kamusKendala.code), asc(kamusKendala.createdAt));
    },
    async insert(workspaceId, entry) {
      await db.insert(kamusKendala).values({ id: crypto.randomUUID(), workspaceId, ...entry });
    },
    async update(workspaceId, id, entry) {
      const updated = await db
        .update(kamusKendala)
        .set(entry)
        .where(and(eq(kamusKendala.workspaceId, workspaceId), eq(kamusKendala.id, id)))
        .returning({ id: kamusKendala.id });
      return updated.length > 0;
    },
    async delete(workspaceId, id) {
      const deleted = await db
        .delete(kamusKendala)
        .where(and(eq(kamusKendala.workspaceId, workspaceId), eq(kamusKendala.id, id)))
        .returning({ id: kamusKendala.id });
      return deleted.length > 0;
    },
  };
}
