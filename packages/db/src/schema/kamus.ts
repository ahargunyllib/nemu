import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { workspace } from "./workspace";

// WS-05 Kamus Kendala: what an error message means, whose fault it is and who fixes it. Nemu
// answers "ini kenapa?" only from these rows, entered by hand or imported from Excel.
export const kamusKendala = sqliteTable(
  "kamus_kendala",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // "K-01": how the entry is cited.
    code: text("code").notNull(),
    // The app that shows the message: AlurSekolah, Ruang GTK, e-Rapor, …
    app: text("app").notNull(),
    message: text("message").notNull(),
    meaning: text("meaning").default("").notNull(),
    teacherFault: integer("teacher_fault", { mode: "boolean" }).default(false).notNull(),
    fixer: text("fixer", { enum: ["guru", "operator", "kepsek", "keuangan", "dinas"] }).notNull(),
    // What the fixer does, as one sentence: "Operator sekolah perlu memetakan …".
    fix: text("fix").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("kamus_kendala_workspace_idx").on(table.workspaceId, table.code)],
);
