import { type Database, eq } from "@nemu/db";
import { referenceTable } from "@nemu/db/schema/reference-tables";

export type ReferenceTableRecord = typeof referenceTable.$inferSelect;
export type NewReferenceTableRecord = typeof referenceTable.$inferInsert;
export type ReferenceTableSummaryRecord = Omit<ReferenceTableRecord, "columns" | "rows">;

export type ReferenceTableRepository = {
  upsert(record: NewReferenceTableRecord): Promise<ReferenceTableRecord>;
  listSummaries(): Promise<ReferenceTableSummaryRecord[]>;
  findByType(type: string): Promise<ReferenceTableRecord | undefined>;
};

export function createReferenceTableRepository(db: Database): ReferenceTableRepository {
  return {
    async upsert(record) {
      const [saved] = await db
        .insert(referenceTable)
        .values(record)
        .onConflictDoUpdate({
          target: referenceTable.type,
          set: {
            fileName: record.fileName,
            columns: record.columns,
            rows: record.rows,
            rowCount: record.rowCount,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!saved) {
        throw new Error(`Saving reference table ${record.type} returned no row`);
      }
      return saved;
    },
    listSummaries() {
      return db
        .select({
          type: referenceTable.type,
          fileName: referenceTable.fileName,
          rowCount: referenceTable.rowCount,
          updatedAt: referenceTable.updatedAt,
        })
        .from(referenceTable);
    },
    async findByType(type) {
      const [found] = await db
        .select()
        .from(referenceTable)
        .where(eq(referenceTable.type, type))
        .limit(1);
      return found;
    },
  };
}
