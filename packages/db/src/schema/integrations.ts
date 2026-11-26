import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { workspace } from "./workspace";

// WS-07: a school's integration settings (AlurSekolah API, Moodle, the Nemu WhatsApp number).
// The value is AES-GCM encrypted with the Worker secret INTEGRATION_SECRETS_KEY; only the last
// four characters are kept in the clear, so the Admin Workspace can show "terpasang · …1234".
export const integrationSecret = sqliteTable(
  "integration_secret",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text("name", {
      enum: [
        "alursekolah_base_url",
        "alursekolah_api_key",
        "moodle_url",
        "moodle_token",
        "whatsapp_number",
      ],
    }).notNull(),
    // Base64 of the 12-byte IV and of the ciphertext with its tag.
    iv: text("iv").notNull(),
    ciphertext: text("ciphertext").notNull(),
    lastFour: text("last_four").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.name] })],
);
