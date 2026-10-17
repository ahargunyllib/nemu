import { drizzle } from "drizzle-orm/d1";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(env: DatabaseConfig) {
  return drizzle(env.DB, { relations });
}

export type Database = ReturnType<typeof createDb>;

// Query operators for repositories outside this package, so they share one drizzle-orm instance.
export { desc, eq, getColumns, like } from "drizzle-orm";
