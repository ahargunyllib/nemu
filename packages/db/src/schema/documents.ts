import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Metadata for a knowledge document the admin uploads in the Admin Workspace.
// The file itself lives in the DOCUMENTS R2 bucket under `storageKey`.
export const knowledgeDocument = sqliteTable(
  "knowledge_document",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    version: text("version").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["ready", "failed"] }).notNull(),
    failureReason: text("failure_reason"),
    format: text("format", { enum: ["pdf", "md"] }).notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("knowledge_document_createdAt_idx").on(table.createdAt)],
);
