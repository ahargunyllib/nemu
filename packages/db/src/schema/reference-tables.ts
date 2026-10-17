import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type ReferenceTableValue = string | number;
export type ReferenceTableRow = Record<string, ReferenceTableValue>;

// The latest uploaded CSV for each Reference Table type (the SBM tables and the
// Kalender Libur). A new upload of the same type replaces the stored rows.
export const referenceTable = sqliteTable("reference_table", {
  type: text("type").primaryKey(),
  fileName: text("file_name").notNull(),
  columns: text("columns", { mode: "json" }).$type<string[]>().notNull(),
  rows: text("rows", { mode: "json" }).$type<ReferenceTableRow[]>().notNull(),
  rowCount: integer("row_count").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
