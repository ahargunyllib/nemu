import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { MockEnv } from "../env";
import app from "../worker";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");

export const KUNCI_UJI = "as_kunci_uji";

/** The part of D1Database the mock calls, over in-memory SQLite with the mock's migrations applied. */
function createD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).sort()) {
    sqlite.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  function statement(query: string, params: SQLInputValue[] = []) {
    const execute = () => sqlite.prepare(query).all(...params);
    return {
      bind: (...values: SQLInputValue[]) => statement(query, values),
      execute,
      all: async () => ({ success: true, meta: {}, results: execute() }),
      run: async () => ({ success: true, meta: {}, results: execute() }),
    };
  }
  const d1 = {
    prepare: (query: string) => statement(query),
    async batch(statements: ReturnType<typeof statement>[]) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((s) => ({ success: true, meta: {}, results: s.execute() }));
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return d1 as unknown as D1Database;
}

/** A fresh mock Worker with its own empty database; every call sees the same data, like two browsers. */
export function createMock() {
  const env: MockEnv = { DB: createD1(), API_KEY: KUNCI_UJI };
  const json = (method: string, body: unknown) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    /** A call the mock page makes on its own origin. */
    page: (path: string, init?: { method: string; body: unknown }) =>
      app.request(`/_mock${path}`, init ? json(init.method, init.body) : {}, env),
    /** A read API call with the school key (or the given Authorization header). */
    api: (path: string, authorization = `Bearer ${KUNCI_UJI}`) =>
      app.request(`/api/v1${path}`, { headers: { Authorization: authorization } }, env),
  };
}
