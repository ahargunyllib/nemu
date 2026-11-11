import { and, type Database, eq } from "@nemu/db";
import { ruleSource } from "@nemu/db/schema/documents";

export type RuleSourceRecord = typeof ruleSource.$inferSelect;
export type NewRuleSourceRecord = typeof ruleSource.$inferInsert;

export type RuleSourceRepository = {
  list(workspaceId: string): Promise<RuleSourceRecord[]>;
  upsert(record: NewRuleSourceRecord): Promise<void>;
  delete(workspaceId: string, key: string): Promise<void>;
};

export function createRuleSourceRepository(db: Database): RuleSourceRepository {
  return {
    list(workspaceId) {
      return db.select().from(ruleSource).where(eq(ruleSource.workspaceId, workspaceId));
    },
    async upsert(record) {
      await db
        .insert(ruleSource)
        .values(record)
        .onConflictDoUpdate({
          target: [ruleSource.workspaceId, ruleSource.key],
          set: {
            documentId: record.documentId,
            article: record.article ?? null,
            page: record.page ?? null,
            updatedAt: new Date(),
          },
        });
    },
    async delete(workspaceId, key) {
      await db
        .delete(ruleSource)
        .where(and(eq(ruleSource.workspaceId, workspaceId), eq(ruleSource.key, key)));
    },
  };
}
