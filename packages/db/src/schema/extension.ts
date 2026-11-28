import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { workspace } from "./workspace";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

// The code a school operator types into the Nemu Extension's settings once. The Nemu Service takes
// extension requests only with a valid one, and it tells which school they come from (ADR-0015).
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

// WS-03: the websites where the Nemu button and page reading run, per school (ADR-0016).
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
    // What Nemu may do there: read and fill fields, prepare a message for the teacher to send, or
    // only read and point (WS-03). The executor (#202) refuses anything the site doesn't allow.
    permission: text("permission", { enum: ["read_fill", "prepare_message", "read_only"] })
      .default("read_fill")
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("allowed_site_workspace_pattern_unique").on(table.workspaceId, table.pattern),
  ],
);

// WS-08: how Nemu works for every teacher of a school. The extension reads it with the WS-03 list
// (`extensionConfig`), so a change needs no extension update. A school without a row uses defaults.
export const schoolSetting = sqliteTable("school_setting", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspace.id, { onDelete: "cascade" }),
  // The combination the teacher holds to talk, as "Ctrl+Space".
  talkShortcut: text("talk_shortcut").default("Ctrl+Space").notNull(),
  // Cara 1 Nemu kerjakan, Ibu lihat · cara 2 Nemu tunjuk, Ibu isi · cara 3 guru isi, Nemu cek (PRD §6.1).
  defaultCara: text("default_cara", { enum: ["isi", "tunjuk", "cek"] })
    .default("isi")
    .notNull(),
  // How fast cara 1 fills: pelan, normal (about one field a second) or cepat.
  fillSpeed: text("fill_speed", { enum: ["pelan", "normal", "cepat"] })
    .default("normal")
    .notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
