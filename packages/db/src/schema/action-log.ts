import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { schoolTeacher } from "./school";
import { workspace } from "./workspace";

// WS-10: every action the Nemu Extension's executor takes on a page (#202): who, when, on which
// website, what and how it ended. It names the target field, never the value typed into it, so no
// grade is ever stored here.
export const actionLog = sqliteTable(
  "action_log",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // Who: the WS-06 teacher the extension asked as, kept by name too if the teacher is removed.
    teacherId: text("teacher_id").references(() => schoolTeacher.id, { onDelete: "set null" }),
    teacherName: text("teacher_name").notNull(),
    // When the extension took the action (not when the row arrived).
    actedAt: integer("acted_at", { mode: "timestamp_ms" }).notNull(),
    // The page's host, e.g. nemu-alursekolah.ahargunyllib.dev.
    website: text("website").notNull(),
    // The task's title, e.g. "Isi nilai UTS Matematika 4B".
    task: text("task").notNull(),
    // A step verb (point, setValue, selectOption, check, scroll, clickMenu) or start/finish/stop.
    action: text("action").notNull(),
    // The target's accessible name ("Nilai Budi Santoso"); "" for start/finish/stop.
    target: text("target").notNull(),
    // Cara 1 (Nemu fills), 2 (Nemu points, the teacher types) or 3 (Nemu checks after Simpan).
    cara: integer("cara").notNull(),
    result: text("result", {
      enum: ["done", "refused", "teacher", "stopped", "failed"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("action_log_workspace_acted_idx").on(table.workspaceId, table.actedAt)],
);
