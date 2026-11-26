import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { workspace } from "./workspace";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

// The code a school operator types into the Nemu Extension's settings once. The Nemu Service takes
// extension requests only with a valid one, and it tells which school they come from (ADR-0014).
export const schoolInstallCode = sqliteTable(
  "school_install_code",
  {
    code: text("code").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("school_install_code_workspace_unique").on(table.workspaceId)],
);

// WS-03: the websites where the Nemu button and page reading run, per school (ADR-0015).
// `pattern` is a host, `*.`-wildcard host, or either with a port (see `siteMatches`).
export const allowedSite = sqliteTable(
  "allowed_site",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    label: text("label").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("allowed_site_workspace_pattern_unique").on(table.workspaceId, table.pattern),
  ],
);
