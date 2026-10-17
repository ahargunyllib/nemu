import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { Citation, NemuAction } from "@nemu/contracts";

import { user } from "./auth";

export const CHAT_LOG_STATUSES = ["answer", "clarify", "refuse", "error"] as const;

// One row per nemuChat request. The Area Crop image is never stored, only
// whether one was attached.
export const chatLog = sqliteTable(
  "chat_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    url: text("url").notNull(),
    prompt: text("prompt").notNull(),
    hasAreaCrop: integer("has_area_crop", { mode: "boolean" }).notNull(),
    status: text("status", { enum: CHAT_LOG_STATUSES }).notNull(),
    // The Answer Card summary, or why the request failed.
    result: text("result").notNull(),
    citations: text("citations", { mode: "json" }).$type<Citation[]>().notNull(),
    actions: text("actions", { mode: "json" }).$type<NemuAction[]>().notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("chat_log_createdAt_idx").on(table.createdAt)],
);
