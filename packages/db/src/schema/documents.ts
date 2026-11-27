import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

// WS-02: a knowledge package Javan maintains, such as the built-in AlurSekolah guide. With
// `allSchools`, Nemu answers every school from its active documents, not only the owner's.
export const knowledgePackage = sqliteTable("knowledge_package", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  allSchools: integer("all_schools", { mode: "boolean" }).default(false).notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Metadata for a knowledge document the admin uploads in the Admin Workspace.
// The file itself lives in the DOCUMENTS R2 bucket under `storageKey`.
export const knowledgeDocument = sqliteTable(
  "knowledge_document",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").default("W-TRAVEL").notNull(),
    title: text("title").notNull(),
    version: text("version").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["ready", "failed"] }).notNull(),
    failureReason: text("failure_reason"),
    format: text("format", { enum: ["pdf", "md", "bpmn", "procedure"] }).notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    // WS-04: the WS-03 allowed websites (ids) the document applies to; empty means every site.
    siteIds: text("site_ids", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`)
      .notNull(),
    // WS-02: the package the document belongs to, or null for the school's own knowledge.
    packageId: text("package_id").references(() => knowledgePackage.id, { onDelete: "set null" }),
    // Who uploaded it, and who last switched it on or off (WS-04 "who and when").
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("knowledge_document_workspaceId_idx").on(table.workspaceId),
    index("knowledge_document_createdAt_idx").on(table.createdAt),
  ],
);

export const knowledgeChunk = sqliteTable(
  "knowledge_chunk",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: "cascade" }),
    article: text("article"),
    section: text("section"),
    page: integer("page"),
    sequence: integer("sequence").notNull(),
    text: text("text").notNull(),
  },
  (table) => [index("knowledge_chunk_documentId_idx").on(table.documentId, table.sequence)],
);

// Where an admin points a deterministic rule's citation. A rule without a row cites its default
// location from RULE_SOURCES in @nemu/ai.
export const ruleSource = sqliteTable(
  "rule_source",
  {
    workspaceId: text("workspace_id").notNull(),
    key: text("key").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: "cascade" }),
    article: text("article"),
    page: integer("page"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.key] })],
);

// WS-04 / F3-11 / F3-19: each task, end event and triggering event (start, boundary, catch) of an
// uploaded BPMN, with the symptoms a teacher or parent sees there, the step that undoes it, the
// school role who can help, and the AlurSekolah page a user task is done on. Created on upload;
// the operator corrects them in the Admin Workspace.
export const processElement = sqliteTable(
  "process_element",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: "cascade" }),
    elementId: text("element_id").notNull(),
    kind: text("kind", { enum: ["task", "end", "event"] }).notNull(),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull(),
    symptoms: text("symptoms", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`)
      .notNull(),
    // F3-12: the element whose step ends this symptom ("Unlock" for "Lock"), or null.
    wayBack: text("way_back"),
    // F3-12: the school role who can help here ("bagian keuangan"), matched to a WS-06 contact.
    role: text("role"),
    // The page (menu label) a user task is done on; null for end events.
    page: text("page"),
    // Whether `page` was edited by hand rather than taken from the task label.
    pageEdited: integer("page_edited", { mode: "boolean" }).default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.elementId] })],
);
