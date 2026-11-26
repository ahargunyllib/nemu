import { and, type Database, eq, inArray } from "@nemu/db";
import { integrationSecret } from "@nemu/db/schema/integrations";

export type IntegrationSecretRecord = typeof integrationSecret.$inferSelect;
export type IntegrationSecretName = IntegrationSecretRecord["name"];

/** WS-07 storage: one encrypted value per workspace and setting. */
export type IntegrationSecretRepository = {
  list(workspaceId: string): Promise<IntegrationSecretRecord[]>;
  find(
    workspaceId: string,
    names: readonly IntegrationSecretName[],
  ): Promise<IntegrationSecretRecord[]>;
  upsert(record: Omit<IntegrationSecretRecord, "updatedAt">): Promise<void>;
};

export function createIntegrationSecretRepository(db: Database): IntegrationSecretRepository {
  return {
    list(workspaceId) {
      return db
        .select()
        .from(integrationSecret)
        .where(eq(integrationSecret.workspaceId, workspaceId));
    },
    find(workspaceId, names) {
      return db
        .select()
        .from(integrationSecret)
        .where(
          and(
            eq(integrationSecret.workspaceId, workspaceId),
            inArray(integrationSecret.name, [...names]),
          ),
        );
    },
    async upsert(record) {
      await db
        .insert(integrationSecret)
        .values(record)
        .onConflictDoUpdate({
          target: [integrationSecret.workspaceId, integrationSecret.name],
          set: {
            iv: record.iv,
            ciphertext: record.ciphertext,
            lastFour: record.lastFour,
            updatedBy: record.updatedBy,
            updatedAt: new Date(),
          },
        });
    },
  };
}
