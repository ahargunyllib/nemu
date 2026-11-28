import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { schoolTeacher } from "./school";
import { workspace } from "./workspace";

// "Pertanyaan guru": one row per question a teacher asks Nemu, so the Admin Workspace can count
// this week's questions and the ones Nemu couldn't answer (ADR-0022). It keeps neither the
// question's words nor the answer: only who, when, which kind and whether Nemu had a source.
export const teacherQuestion = sqliteTable(
  "teacher_question",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // The WS-06 teacher who asked; the count stays if the teacher is removed.
    teacherId: text("teacher_id").references(() => schoolTeacher.id, { onDelete: "set null" }),
    askedAt: integer("asked_at", { mode: "timestamp_ms" }).notNull(),
    // "tanya": a question to the school's guides (F3). "kenapa": "ini kenapa?" on a page (F2).
    kind: text("kind", { enum: ["tanya", "kenapa"] }).notNull(),
    // False when Nemu said it isn't in the school's guide (or process) instead of answering.
    answered: integer("answered", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("teacher_question_workspace_asked_idx").on(table.workspaceId, table.askedAt)],
);
