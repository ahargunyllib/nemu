import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { createDb } from "@nemu/db";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../db/src/migrations");

// A D1 binding over in-memory SQLite that keeps the D1 rules drizzle has to live with:
// no BEGIN or SAVEPOINT, at most 100 bound parameters, and `batch` as the atomic write.
function createD1(sqlite: DatabaseSync) {
  function statement(query: string, params: SQLInputValue[] = []) {
    function execute() {
      if (/^\s*(begin|savepoint|commit|rollback|release)\b/i.test(query)) {
        throw new Error("D1_ERROR: use batch() instead of BEGIN TRANSACTION or SAVEPOINT");
      }
      if (params.length > 100) throw new Error("D1_ERROR: too many SQL variables");
      return sqlite.prepare(query).all(...params);
    }
    return {
      bind: (...values: SQLInputValue[]) => statement(query, values),
      execute,
      all: async () => ({ success: true, meta: {}, results: execute() }),
      run: async () => ({ success: true, meta: {}, results: execute() }),
      first: async () => execute()[0] ?? null,
      raw: async () => execute().map((row) => Object.values(row)),
    };
  }
  const d1 = {
    prepare: (query: string) => statement(query),
    async batch(statements: ReturnType<typeof statement>[]) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((stmt) => ({
          success: true,
          meta: {},
          results: stmt.execute(),
        }));
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // The fake covers the part of D1Database that drizzle's D1 driver calls.
  return d1 as unknown as D1Database;
}

/** A drizzle database over in-memory SQLite with every migration applied, as D1 would have it. */
export async function createMigratedDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of (await readdir(MIGRATIONS_DIR)).sort()) {
    const file = join(MIGRATIONS_DIR, migration, "migration.sql");
    // Git doesn't track empty folders, so a local checkout can hold one that CI never sees.
    if (existsSync(file)) sqlite.exec(await readFile(file, "utf8"));
  }
  return createDb({ DB: createD1(sqlite) });
}
