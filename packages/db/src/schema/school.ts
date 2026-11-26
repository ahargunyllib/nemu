import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { workspace } from "./workspace";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull();

// A teacher the school operator registers in WS-06. The extension recognises them by their
// AlurSekolah email and the WhatsApp bot by their phone number (digits, 62… without "+").
export const schoolTeacher = sqliteTable(
  "school_teacher",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    // The Admin Workspace account of a teacher who also signs in there (Bu Siti in the demo).
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    honorific: text("honorific", { enum: ["Bu", "Pak"] }).notNull(),
    nip: text("nip").default("").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    classes: text("classes", { mode: "json" }).$type<string[]>().notNull(),
    subjects: text("subjects", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("school_teacher_email_unique").on(table.email),
    uniqueIndex("school_teacher_phone_unique").on(table.phone),
    index("school_teacher_workspaceId_idx").on(table.workspaceId),
  ],
);

// Who a teacher is pointed to when something isn't theirs to fix, one per role and school.
export const schoolContact = sqliteTable(
  "school_contact",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    role: text("role", { enum: ["operator", "kepsek", "keuangan"] }).notNull(),
    name: text("name").notNull(),
    honorific: text("honorific", { enum: ["Bu", "Pak"] }).notNull(),
    phone: text("phone").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("school_contact_workspace_role_unique").on(table.workspaceId, table.role),
  ],
);

// A class roster row, seeded from the school's daftar siswa. Grade photos are matched to it.
export const schoolStudent = sqliteTable(
  "school_student",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    className: text("class_name").notNull(),
    number: integer("number").notNull(),
    // NIS or NISN, whichever the daftar siswa gives.
    nis: text("nis").notNull(),
    name: text("name").notNull(),
  },
  (table) => [index("school_student_class_idx").on(table.workspaceId, table.className)],
);
