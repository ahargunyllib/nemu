import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vite-plus/test";

import { DEMO_SEED_DOCUMENTS, DEMO_SEED_INSTANCES } from "./demo-seed";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../../db/src/migrations");

async function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const folder of (await readdir(MIGRATIONS_DIR)).toSorted()) {
    db.exec(await readFile(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8"));
  }
  return db;
}

function selectRows(db: DatabaseSync, table: string, rows: readonly Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  const columns = keys.map(
    (key) => `${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} AS ${key}`,
  );
  return db
    .prepare(`SELECT ${columns.join(", ")} FROM ${table} ORDER BY rowid`)
    .all()
    .map((row) => ({ ...row }));
}

// The seed migration and the fixes after it put the 3-Momen fixtures in every database, as the demo
// panel's reset does. After changing demo-seed.ts, add a migration that brings applied databases in line.
describe("demo seed migrations", () => {
  it("seed exactly the fixtures the demo panel's reset restores", async () => {
    const db = await migratedDatabase();

    expect(selectRows(db, "process_instance", DEMO_SEED_INSTANCES)).toEqual(DEMO_SEED_INSTANCES);
    expect(selectRows(db, "process_document", DEMO_SEED_DOCUMENTS)).toEqual(DEMO_SEED_DOCUMENTS);
  });
});
